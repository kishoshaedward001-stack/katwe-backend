const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');
const { Resend } = require('resend');
const africastalking = require('africastalking');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ============ DATABASE CONNECTION ============
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ============ AUTO-CREATE TABLES ============
const createTables = async () => {
    try {
        // Create students table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                "fullName" VARCHAR(255) NOT NULL,
                age INTEGER NOT NULL,
                gender VARCHAR(10) NOT NULL,
                course VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(255),
                photo TEXT,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Students table ready');
        
        // Create parents table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS parents (
                id SERIAL PRIMARY KEY,
                "parentCode" VARCHAR(20) UNIQUE NOT NULL,
                "parentName" VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(255),
                "studentId" INTEGER REFERENCES students(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Parents table ready');
        
        // Create index for faster lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_parents_code ON parents("parentCode")
        `);
        console.log('✅ Parents index created');
        
    } catch (err) {
        console.error('❌ Error creating tables:', err.message);
    }
};

// Test database connection and create tables
pool.connect(async (err, client, release) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.message);
    } else {
        console.log('✅ Connected to PostgreSQL database');
        await createTables();
        release();
    }
});

// ============ CLOUDINARY CONFIGURATION ============
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'student_photos',
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
        transformation: [{ width: 200, height: 200, crop: 'fill' }]
    }
});

const upload = multer({ storage: storage });

// ============ AFRICA'S TALKING SMS ============
let sms = null;
if (process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME) {
    const africasTalking = africastalking({
        apiKey: process.env.AFRICASTALKING_API_KEY,
        username: process.env.AFRICASTALKING_USERNAME
    });
    sms = africasTalking.SMS;
    console.log('✅ Africa\'s Talking SMS initialized');
} else {
    console.log('⚠️ Africa\'s Talking credentials not set. SMS disabled.');
}

// ============ RESEND EMAIL ============
let resend = null;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend email initialized');
} else {
    console.log('⚠️ Resend API key not set. Email disabled.');
}

// ============ API ENDPOINTS ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload photo endpoint
app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        res.json({ 
            success: true, 
            imageUrl: req.file.path,
            publicId: req.file.filename
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET all students
app.get('/api/students', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM students ORDER BY "createdAt" DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET single student
app.get('/api/students/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM students WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching student:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST new student
app.post('/api/students', async (req, res) => {
    const { fullName, age, gender, course, phone, email, photo } = req.body;
    
    if (!fullName || !age || !gender || !course) {
        return res.status(400).json({ message: 'Missing required fields: fullName, age, gender, course' });
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO students ("fullName", age, gender, course, phone, email, photo) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [fullName, age, gender, course, phone || null, email || null, photo || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating student:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT update student
app.put('/api/students/:id', async (req, res) => {
    const { fullName, age, gender, course, phone, email, photo } = req.body;
    try {
        const result = await pool.query(
            `UPDATE students SET 
                "fullName" = $1, 
                age = $2, 
                gender = $3, 
                course = $4, 
                phone = $5, 
                email = $6, 
                photo = $7 
             WHERE id = $8 
             RETURNING *`,
            [fullName, age, gender, course, phone, email, photo, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json({ message: 'Student updated successfully', student: result.rows[0] });
    } catch (err) {
        console.error('Error updating student:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE student
app.delete('/api/students/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        console.error('Error deleting student:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============ PARENT MODULE ENDPOINTS ============

// Generate parent code
app.post('/api/parents/generate', async (req, res) => {
    const { studentId, parentName, phone, email } = req.body;
    
    if (!studentId || !parentName) {
        return res.status(400).json({ error: 'Student ID and Parent Name are required' });
    }
    
    // Generate random 6-digit code
    const parentCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
        // Check if parent already exists for this student
        const existing = await pool.query(
            'SELECT * FROM parents WHERE "studentId" = $1',
            [studentId]
        );
        
        if (existing.rows.length > 0) {
            return res.json({ 
                success: true, 
                parentCode: existing.rows[0].parentCode,
                message: 'Parent code already exists',
                parent: existing.rows[0]
            });
        }
        
        const result = await pool.query(
            `INSERT INTO parents ("parentCode", "parentName", phone, email, "studentId") 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [parentCode, parentName, phone || null, email || null, studentId]
        );
        
        res.json({ success: true, parentCode, parent: result.rows[0] });
    } catch (err) {
        console.error('Error generating parent code:', err);
        res.status(500).json({ error: err.message });
    }
});

// Parent login
app.post('/api/parents/login', async (req, res) => {
    const { parentCode } = req.body;
    
    if (!parentCode) {
        return res.status(400).json({ error: 'Parent code is required' });
    }
    
    try {
        const result = await pool.query(
            `SELECT p.*, s."fullName" as "studentName", s.course, s.photo, s.age, s.gender, s.phone as "studentPhone", s.email as "studentEmail"
             FROM parents p
             JOIN students s ON p."studentId" = s.id
             WHERE p."parentCode" = $1`,
            [parentCode]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid parent code' });
        }
        
        res.json({ success: true, parent: result.rows[0] });
    } catch (err) {
        console.error('Parent login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get student info for parent
app.get('/api/parents/:parentCode/student', async (req, res) => {
    const { parentCode } = req.params;
    
    try {
        const result = await pool.query(
            `SELECT s.* 
             FROM students s
             JOIN parents p ON p."studentId" = s.id
             WHERE p."parentCode" = $1`,
            [parentCode]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        res.json({ success: true, student: result.rows[0] });
    } catch (err) {
        console.error('Error fetching student:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all parents (for admin)
app.get('/api/parents', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, s."fullName" as "studentName" 
             FROM parents p
             JOIN students s ON p."studentId" = s.id
             ORDER BY p."createdAt" DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching parents:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete parent by id
app.delete('/api/parents/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM parents WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Parent deleted successfully' });
    } catch (err) {
        console.error('Error deleting parent:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============ SEND EMAIL WITH RESEND ============
app.post('/api/send-results', async (req, res) => {
    const { student, results } = req.body;
    
    console.log('📧 Received email request for:', student?.email);
    
    if (!student || !results) {
        console.log('❌ Missing student or results');
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!resend) {
        console.error('❌ Resend not configured');
        return res.status(500).json({ error: 'Email service not configured. Please add RESEND_API_KEY to environment variables.' });
    }
    
    const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; background: linear-gradient(135deg, #1e3c72, #2a5298); padding: 20px; border-radius: 10px 10px 0 0; color: white;">
                <h2>🏫 Katwe Secondary School</h2>
                <h3>Matokeo ya Mitihani</h3>
            </div>
            <div style="padding: 20px;">
                <p><strong>👨‍🎓 Jina la Mwanafunzi:</strong> ${student.fullName}</p>
                <p><strong>📚 Kozi:</strong> ${student.course}</p>
                <p><strong>📧 Barua pepe:</strong> ${student.email}</p>
                <hr/>
                <h3>📊 Matokeo:</h3>
                <ul>
                    <li><strong>${results.subject1 || 'N/A'}:</strong> ${results.grade1 || 'N/A'}</li>
                    <li><strong>${results.subject2 || 'N/A'}:</strong> ${results.grade2 || 'N/A'}</li>
                    <li><strong>${results.subject3 || 'N/A'}:</strong> ${results.grade3 || 'N/A'}</li>
                    <li><strong>${results.subject4 || 'N/A'}:</strong> ${results.grade4 || 'N/A'}</li>
                </ul>
                <p><strong>💬 Maoni ya Mwalimu:</strong></p>
                <p style="background: #f0f0f0; padding: 10px; border-radius: 5px;">${results.remarks || 'Hakuna maoni'}</p>
                <hr/>
                <p style="text-align: center; color: #666; font-size: 12px;">Asante kwa kututumainia<br/>Katwe Secondary School</p>
            </div>
        </div>
    `;
    
    try {
        console.log('📧 Sending email to:', student.email);
        
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: [student.email],
            subject: `📧 Matokeo yako - ${student.fullName}`,
            html: emailContent
        });
        
        if (error) {
            console.error('❌ Resend API error:', error);
            return res.status(500).json({ error: error.message });
        }
        
        console.log('✅ Email sent successfully! ID:', data?.id);
        res.json({ success: true, message: 'Email sent successfully!', data });
    } catch (error) {
        console.error('❌ Email sending error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============ SEND SMS WITH AFRICA'S TALKING ============
app.post('/api/send-sms', async (req, res) => {
    const { student, results } = req.body;
    
    console.log('📱 Received SMS request for:', student?.phone);
    
    if (!student || !results) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!sms) {
        return res.status(500).json({ error: 'SMS service not configured' });
    }
    
    if (!student.phone) {
        return res.status(400).json({ error: 'Student has no phone number' });
    }
    
    // Format phone number correctly
    let phoneNumber = student.phone.toString().trim();
    phoneNumber = phoneNumber.replace(/\D/g, '');
    if (phoneNumber.startsWith('0')) {
        phoneNumber = '255' + phoneNumber.substring(1);
    } else if (!phoneNumber.startsWith('255')) {
        phoneNumber = '255' + phoneNumber;
    }
    
    console.log('📱 Original phone:', student.phone);
    console.log('📱 Formatted phone:', phoneNumber);
    
    const smsContent = `Katwe School: ${student.fullName}, Matokeo: ${results.subject1 || 'N/A'}=${results.grade1 || 'N/A'}, ${results.subject2 || 'N/A'}=${results.grade2 || 'N/A'}. ${results.remarks || 'Asante'}`;
    const finalMessage = smsContent.length > 160 ? smsContent.substring(0, 157) + '...' : smsContent;
    
    try {
        const result = await sms.send({
            to: phoneNumber,
            message: finalMessage,
            from: 'sandbox'
        });
        
        console.log('✅ SMS sent successfully:', result);
        res.json({ success: true, message: 'SMS sent successfully!', result });
    } catch (error) {
        console.error('❌ SMS error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
    console.log(`📧 Email endpoint: http://localhost:${PORT}/api/send-results`);
    console.log(`📱 SMS endpoint: http://localhost:${PORT}/api/send-sms`);
    console.log(`👨‍👩‍👧 Parent endpoints: /api/parents/*`);
});