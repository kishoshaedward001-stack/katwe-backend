const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============ CLOUDINARY CONFIGURATION ============
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dtfgbybqv',
    api_key: process.env.CLOUDINARY_API_KEY || '935441121923263',
    api_secret: process.env.CLOUDINARY_API_SECRET || '2BTkkMm2ialzU0W7mTqSsq5MR-c'
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

// ============ JSON FILE DATABASE ============
const DB_FILE = path.join(__dirname, 'db.json');

// Initialize database
if (!fs.existsSync(DB_FILE)) {
    const initialData = {
        users: [],
        students: [],
        classes: [],
        timetables: [],
        parents: [],
        results: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

// Helper functions
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// Initialize default users
let db = readDB();
if (db.users.length === 0) {
    db.users = [
        { 
            id: 1, 
            username: 'admin', 
            email: 'admin@katwe.edu',
            password: 'YWRtaW4xMjM=', // admin123 in base64
            fullName: 'Admin Mkuu', 
            role: 'admin', 
            isApproved: true,
            createdAt: new Date().toISOString()
        },
        { 
            id: 2, 
            username: 'teacher', 
            email: 'teacher@katwe.edu',
            password: 'dGVhY2hlcjEyMw==', // teacher123 in base64
            fullName: 'Mwalimu Juma', 
            role: 'user', 
            isApproved: true,
            createdAt: new Date().toISOString()
        }
    ];
    writeDB(db);
    console.log('✅ Default users added');
}

// ============ UPLOAD PHOTO ENDPOINT ============
app.post('/api/upload-photo', upload.single('photo'), (req, res) => {
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

// ============ AUTH ENDPOINTS ============

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = Buffer.from(password).toString('base64');
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === hashedPassword);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.isApproved) {
        return res.status(401).json({ error: 'Account not approved' });
    }
    
    res.json({ 
        success: true, 
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

// Register
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName, phone } = req.body;
    const db = readDB();
    
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }
    
    const newUser = {
        id: Date.now(),
        username,
        email,
        password: Buffer.from(password).toString('base64'),
        fullName: fullName || '',
        phone: phone || '',
        role: 'user',
        isApproved: false,
        createdAt: new Date().toISOString()
    };
    
    db.users.push(newUser);
    writeDB(db);
    res.json({ success: true, message: 'Registration successful! Please wait for admin approval.' });
});

// Get all users (admin)
app.get('/api/users', (req, res) => {
    const db = readDB();
    const users = db.users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        role: u.role,
        isApproved: u.isApproved,
        createdAt: u.createdAt
    }));
    res.json(users);
});

// Approve user
app.put('/api/users/:id/approve', (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id == req.params.id);
    if (user) {
        user.isApproved = true;
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
    let db = readDB();
    db.users = db.users.filter(u => u.id != req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// ============ STUDENT ENDPOINTS ============

// Get all students
app.get('/api/students', (req, res) => {
    const db = readDB();
    res.json(db.students || []);
});

// Get single student
app.get('/api/students/:id', (req, res) => {
    const db = readDB();
    const student = db.students.find(s => s.id == req.params.id);
    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
});

// Create student
app.post('/api/students', (req, res) => {
    const db = readDB();
    const newStudent = {
        id: Date.now(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    db.students.push(newStudent);
    writeDB(db);
    res.status(201).json(newStudent);
});

// Update student
app.put('/api/students/:id', (req, res) => {
    const db = readDB();
    const index = db.students.findIndex(s => s.id == req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Student not found' });
    }
    db.students[index] = { ...db.students[index], ...req.body };
    writeDB(db);
    res.json(db.students[index]);
});

// Delete student
app.delete('/api/students/:id', (req, res) => {
    const db = readDB();
    db.students = db.students.filter(s => s.id != req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// ============ CLASSES ENDPOINTS ============

// Get all classes
app.get('/api/classes', (req, res) => {
    const db = readDB();
    res.json(db.classes || []);
});

// Add class
app.post('/api/classes', (req, res) => {
    const db = readDB();
    const newClass = {
        id: Date.now(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    db.classes.push(newClass);
    writeDB(db);
    res.status(201).json(newClass);
});

// Delete class
app.delete('/api/classes/:id', (req, res) => {
    const db = readDB();
    db.classes = db.classes.filter(c => c.id != req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// ============ TIMETABLE ENDPOINTS ============

// Get timetable by class
app.get('/api/timetable/:classId', (req, res) => {
    const db = readDB();
    const timetable = (db.timetables || []).filter(t => t.classId == req.params.classId);
    res.json(timetable);
});

// Add timetable entry
app.post('/api/timetable', (req, res) => {
    const db = readDB();
    const newEntry = {
        id: Date.now(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    db.timetables.push(newEntry);
    writeDB(db);
    res.status(201).json(newEntry);
});

// Delete timetable entry
app.delete('/api/timetable/:id', (req, res) => {
    const db = readDB();
    db.timetables = db.timetables.filter(t => t.id != req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// ============ PARENT ENDPOINTS ============

// Generate parent code
app.post('/api/parents/generate', (req, res) => {
    const { studentId, parentName, phone, email } = req.body;
    const parentCode = Math.floor(100000 + Math.random() * 900000).toString();
    const db = readDB();
    
    const newParent = {
        id: Date.now(),
        parentCode,
        parentName,
        phone,
        email,
        studentId,
        createdAt: new Date().toISOString()
    };
    db.parents.push(newParent);
    writeDB(db);
    res.json({ success: true, parentCode });
});

// Parent login
app.post('/api/parents/login', (req, res) => {
    const { parentCode } = req.body;
    const db = readDB();
    const parent = db.parents.find(p => p.parentCode === parentCode);
    
    if (!parent) {
        return res.status(401).json({ error: 'Invalid parent code' });
    }
    
    const student = db.students.find(s => s.id == parent.studentId);
    res.json({ 
        success: true, 
        parent: {
            ...parent,
            studentName: student?.fullName,
            studentCourse: student?.course,
            studentPhoto: student?.photo
        }
    });
});

// Get parent results
app.get('/api/parents/:parentCode/results', (req, res) => {
    const { parentCode } = req.params;
    const db = readDB();
    const parent = db.parents.find(p => p.parentCode === parentCode);
    
    if (!parent) {
        return res.status(404).json({ error: 'Parent not found' });
    }
    
    const results = (db.results || []).filter(r => r.studentId == parent.studentId);
    res.json({ success: true, results });
});

// Get student for parent
app.get('/api/parents/:parentCode/student', (req, res) => {
    const { parentCode } = req.params;
    const db = readDB();
    const parent = db.parents.find(p => p.parentCode === parentCode);
    
    if (!parent) {
        return res.status(404).json({ error: 'Parent not found' });
    }
    
    const student = db.students.find(s => s.id == parent.studentId);
    res.json({ success: true, student: student || null });
});

// ============ RESULTS ENDPOINTS ============

// Save results
app.post('/api/results', (req, res) => {
    const db = readDB();
    const newResult = {
        id: Date.now(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    db.results.push(newResult);
    writeDB(db);
    res.json({ success: true });
});

// Get results by student
app.get('/api/students/:studentId/results', (req, res) => {
    const db = readDB();
    const results = (db.results || []).filter(r => r.studentId == req.params.studentId);
    res.json(results);
});

// ============ SEND EMAIL (Mock) ============
app.post('/api/send-results', (req, res) => {
    const { student, results } = req.body;
    console.log('📧 Email would be sent to:', student?.email);
    console.log('📧 Content:', results);
    res.json({ success: true, message: 'Email sent (simulated)' });
});

// ============ SEND SMS (Mock) ============
app.post('/api/send-sms', (req, res) => {
    const { student, results } = req.body;
    console.log('📱 SMS would be sent to:', student?.phone);
    console.log('📱 Content:', results);
    res.json({ success: true, message: 'SMS sent (simulated)' });
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Health: http://localhost:${PORT}/api/health`);
    console.log(`✅ Admin: admin / admin123`);
    console.log(`✅ Teacher: teacher / teacher123`);
    console.log(`📁 Database: ${DB_FILE}`);
});