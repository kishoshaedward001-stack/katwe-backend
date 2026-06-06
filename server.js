const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');
const { Resend } = require('resend');

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

// ============ AUTO-CREATE TABLE ============
const createTable = async () => {
    try {
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
        console.log('✅ Students table is ready');
    } catch (err) {
        console.error('❌ Error creating table:', err.message);
    }
};

// Test database connection and create table
pool.connect(async (err, client, release) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.message);
    } else {
        console.log('✅ Connected to PostgreSQL database');
        await createTable();
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

// ============ SEND EMAIL WITH RESEND ============
app.post('/api/send-results', async (req, res) => {
    const { student, results } = req.body;
    
    console.log('📧 Received email request for:', student?.email);
    
    if (!student || !results) {
        console.log('❌ Missing student or results');
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!process.env.RESEND_API_KEY) {
        console.error('❌ RESEND_API_KEY not configured');
        return res.status(500).json({ error: 'Email service not configured. Please add RESEND_API_KEY to environment variables.' });
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});