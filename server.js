const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');
const { Resend } = require('resend');
const africastalking = require('africastalking');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5003;
const JWT_SECRET = process.env.JWT_SECRET || 'katwe_super_secret_key_change_this';

// ============ SECURITY MIDDLEWARE ============
app.use(helmet()); // Security headers
app.use(cors({
    origin: ['http://localhost:3000', 'https://katwe-frontend.onrender.com'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting - kuzuia mashambulizi
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Stricter rate limit for login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts, please try again after 15 minutes.' }
});

// ============ SQLITE DATABASE ============
const db = new sqlite3.Database('./katwe_school.db');

// ============ CREATE TABLES ============
db.serialize(() => {
    // Users table with better security
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullName TEXT,
        phone TEXT,
        role TEXT DEFAULT 'user',
        isApproved INTEGER DEFAULT 0,
        isVerified INTEGER DEFAULT 0,
        verificationToken TEXT,
        resetToken TEXT,
        resetTokenExpiry INTEGER,
        lastLogin DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Other tables (students, parents, results, classes, timetables)
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        course TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        photo TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS parents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentCode TEXT UNIQUE NOT NULL,
        parentName TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        studentId INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId INTEGER,
        subject1 TEXT,
        grade1 TEXT,
        subject2 TEXT,
        grade2 TEXT,
        subject3 TEXT,
        grade3 TEXT,
        subject4 TEXT,
        grade4 TEXT,
        remarks TEXT,
        term TEXT,
        year INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        className TEXT UNIQUE NOT NULL,
        description TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS timetables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        classId INTEGER,
        dayOfWeek TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        subject TEXT NOT NULL,
        teacher TEXT,
        room TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (classId) REFERENCES classes(id) ON DELETE CASCADE
    )`);
    
    // Sessions table for tracking logins
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        token TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME
    )`);
    
    console.log('✅ All tables ready');
});

// ============ HELPER FUNCTIONS ============
const generateToken = (userId, username, role) => {
    return jwt.sign({ userId, username, role }, JWT_SECRET, { expiresIn: '7d' });
};

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

// Admin only middleware
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};

// ============ CLOUDINARY ============
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'student_photos',
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
        transformation: [{ width: 200, height: 200, crop: 'fill' }]
    }
});

const upload = multer({ storage: storage });

// ============ SMS & EMAIL ============
let sms = null;
if (process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME) {
    const africasTalking = africastalking({
        apiKey: process.env.AFRICASTALKING_API_KEY,
        username: process.env.AFRICASTALKING_USERNAME
    });
    sms = africasTalking.SMS;
}

let resend = null;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
}

// ============ AUTH ENDPOINTS ============

// User registration with validation
app.post('/api/auth/register', [
    body('username').isLength({ min: 3 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('fullName').optional().trim().escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    const { username, email, password, fullName, phone } = req.body;
    
    try {
        // Hash password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        db.run(
            `INSERT INTO users (username, email, password, fullName, phone, verificationToken) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, fullName, phone, verificationToken],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Username or email already exists' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                
                // Send verification email
                if (resend && email) {
                    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${verificationToken}`;
                    resend.emails.send({
                        from: 'onboarding@resend.dev',
                        to: [email],
                        subject: 'Verify your email - Katwe School',
                        html: `<p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>`
                    });
                }
                
                res.json({ success: true, message: 'Registration successful! Please verify your email.' });
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User login with rate limiting
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        // Compare password with bcrypt
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
        
        if (!user.isApproved) {
            return res.status(401).json({ error: 'Account pending approval' });
        }
        
        // Update last login
        db.run('UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        // Generate JWT token
        const token = generateToken(user.id, user.username, user.role);
        
        // Store session
        db.run('INSERT INTO sessions (userId, token, expiresAt) VALUES (?, ?, datetime("now", "+7 days"))', 
            [user.id, token]);
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                isApproved: user.isApproved
            }
        });
    });
});

// Verify email
app.get('/api/auth/verify/:token', (req, res) => {
    const { token } = req.params;
    
    db.run('UPDATE users SET isVerified = 1, verificationToken = NULL WHERE verificationToken = ?', 
        [token], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Email verified successfully!' });
        });
});

// Logout
app.post('/api/auth/logout', verifyToken, (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    db.run('DELETE FROM sessions WHERE token = ?', [token]);
    res.json({ success: true });
});

// ============ PROTECTED ENDPOINTS ============

// Get all students (protected)
app.get('/api/students', verifyToken, (req, res) => {
    db.all('SELECT * FROM students ORDER BY createdAt DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST new student (admin only)
app.post('/api/students', verifyToken, isAdmin, (req, res) => {
    const { fullName, age, gender, course, phone, email, photo } = req.body;
    
    db.run(
        'INSERT INTO students (fullName, age, gender, course, phone, email, photo) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [fullName, age, gender, course, phone, email, photo],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID });
        }
    );
});

// PUT update student (admin only)
app.put('/api/students/:id', verifyToken, isAdmin, (req, res) => {
    const { fullName, age, gender, course, phone, email, photo } = req.body;
    db.run(
        'UPDATE students SET fullName=?, age=?, gender=?, course=?, phone=?, email=?, photo=? WHERE id=?',
        [fullName, age, gender, course, phone, email, photo, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Student updated' });
        }
    );
});

// DELETE student (admin only)
app.delete('/api/students/:id', verifyToken, isAdmin, (req, res) => {
    db.run('DELETE FROM students WHERE id=?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Student deleted' });
    });
});

// Upload photo (protected)
app.post('/api/upload-photo', verifyToken, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ success: true, imageUrl: req.file.path });
});

// Get all users (admin only)
app.get('/api/users', verifyToken, isAdmin, (req, res) => {
    db.all('SELECT id, username, email, fullName, phone, role, isApproved, isVerified, createdAt FROM users ORDER BY createdAt DESC', 
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
});

// Approve user (admin only)
app.put('/api/users/:id/approve', verifyToken, isAdmin, (req, res) => {
    db.run('UPDATE users SET isApproved = 1 WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Delete user (admin only)
app.delete('/api/users/:id', verifyToken, isAdmin, (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Get classes (protected)
app.get('/api/classes', verifyToken, (req, res) => {
    db.all('SELECT * FROM classes ORDER BY className', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add class (admin only)
app.post('/api/classes', verifyToken, isAdmin, (req, res) => {
    const { className, description } = req.body;
    db.run('INSERT INTO classes (className, description) VALUES (?, ?)', [className, description], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Get timetable (protected)
app.get('/api/timetable/:classId', verifyToken, (req, res) => {
    db.all('SELECT * FROM timetables WHERE classId = ? ORDER BY dayOfWeek, startTime', [req.params.classId], 
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
});

// Add timetable (admin only)
app.post('/api/timetable', verifyToken, isAdmin, (req, res) => {
    const { classId, dayOfWeek, startTime, endTime, subject, teacher, room } = req.body;
    db.run(
        'INSERT INTO timetables (classId, dayOfWeek, startTime, endTime, subject, teacher, room) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [classId, dayOfWeek, startTime, endTime, subject, teacher, room],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// Delete timetable (admin only)
app.delete('/api/timetable/:id', verifyToken, isAdmin, (req, res) => {
    db.run('DELETE FROM timetables WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============ PARENT ENDPOINTS ============
// Generate parent code (admin only)
app.post('/api/parents/generate', verifyToken, isAdmin, (req, res) => {
    const { studentId, parentName, phone, email } = req.body;
    const parentCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    db.run(
        'INSERT INTO parents (parentCode, parentName, phone, email, studentId) VALUES (?, ?, ?, ?, ?)',
        [parentCode, parentName, phone, email, studentId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, parentCode });
        }
    );
});

// Parent login (no token required)
app.post('/api/parents/login', (req, res) => {
    const { parentCode } = req.body;
    
    db.get(
        `SELECT p.*, s.fullName as studentName, s.course, s.photo 
         FROM parents p
         JOIN students s ON p.studentId = s.id
         WHERE p.parentCode = ?`,
        [parentCode],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!result) return res.status(401).json({ error: 'Invalid parent code' });
            res.json({ success: true, parent: result });
        }
    );
});

// ============ RESULTS ENDPOINTS ============
// Save results (admin only)
app.post('/api/results', verifyToken, isAdmin, (req, res) => {
    const { studentId, subject1, grade1, subject2, grade2, subject3, grade3, subject4, grade4, remarks, term, year } = req.body;
    
    db.run(
        `INSERT INTO results (studentId, subject1, grade1, subject2, grade2, subject3, grade3, subject4, grade4, remarks, term, year) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [studentId, subject1, grade1, subject2, grade2, subject3, grade3, subject4, grade4, remarks, term || 'Term 1', year || new Date().getFullYear()],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// Get results for parent
app.get('/api/parents/:parentCode/results', (req, res) => {
    const { parentCode } = req.params;
    
    db.get('SELECT studentId FROM parents WHERE parentCode = ?', [parentCode], (err, parent) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!parent) return res.status(404).json({ error: 'Parent not found' });
        
        db.all('SELECT * FROM results WHERE studentId = ? ORDER BY year DESC, term DESC', [parent.studentId], 
            (err, results) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, results });
            });
    });
});

// ============ SEND EMAIL ============
app.post('/api/send-results', verifyToken, async (req, res) => {
    const { student, results } = req.body;
    
    if (!resend) return res.status(500).json({ error: 'Email service not configured' });
    
    const emailContent = `<h2>Katwe Secondary School - Matokeo ya Mitihani</h2>
        <p><strong>Jina:</strong> ${student.fullName}</p>
        <p><strong>Kozi:</strong> ${student.course}</p>
        <hr/>
        <h3>Matokeo:</h3>
        <ul>
            <li>${results.subject1 || 'N/A'}: ${results.grade1 || 'N/A'}</li>
            <li>${results.subject2 || 'N/A'}: ${results.grade2 || 'N/A'}</li>
            <li>${results.subject3 || 'N/A'}: ${results.grade3 || 'N/A'}</li>
            <li>${results.subject4 || 'N/A'}: ${results.grade4 || 'N/A'}</li>
        </ul>
        <p><strong>Maoni:</strong> ${results.remarks || 'Hakuna maoni'}</p>`;
    
    try {
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: [student.email],
            subject: `Matokeo yako - ${student.fullName}`,
            html: emailContent
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`🔒 Secure server running on http://localhost:${PORT}`);
    console.log(`✅ JWT authentication enabled`);
    console.log(`✅ Rate limiting enabled`);
    console.log(`✅ Input validation enabled`);
});