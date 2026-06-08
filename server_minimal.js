const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

// ============ MOCK DATABASE ============
let students = [];
let users = [
    { id: 1, username: "admin", password: "YWRtaW4xMjM=", role: "admin", isApproved: true, fullName: "Admin Mkuu" },
    { id: 2, username: "teacher", password: "dGVhY2hlcjEyMw==", role: "user", isApproved: true, fullName: "Mwalimu Juma" }
];

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

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = Buffer.from(password).toString('base64');
    const user = users.find(u => u.username === username && u.password === hashedPassword);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({ 
        success: true, 
        user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            isApproved: user.isApproved
        }
    });
});

app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName, phone } = req.body;
    
    if (users.find(u => u.username === username)) {
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
        isApproved: false
    };
    users.push(newUser);
    res.json({ success: true, message: 'Registration successful! Please wait for admin approval.' });
});

app.get('/api/users', (req, res) => {
    const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        role: u.role,
        isApproved: u.isApproved
    }));
    res.json(safeUsers);
});

app.put('/api/users/:id/approve', (req, res) => {
    const user = users.find(u => u.id == req.params.id);
    if (user) {
        user.isApproved = true;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.delete('/api/users/:id', (req, res) => {
    users = users.filter(u => u.id != req.params.id);
    res.json({ success: true });
});

// ============ STUDENT ENDPOINTS ============

app.get('/api/students', (req, res) => {
    res.json(students);
});

app.get('/api/students/:id', (req, res) => {
    const student = students.find(s => s.id == req.params.id);
    if (!student) return res.status(404).json({ error: 'Not found' });
    res.json(student);
});

app.post('/api/students', (req, res) => {
    const newStudent = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
    students.push(newStudent);
    res.status(201).json(newStudent);
});

app.put('/api/students/:id', (req, res) => {
    const index = students.findIndex(s => s.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    students[index] = { ...students[index], ...req.body };
    res.json(students[index]);
});

app.delete('/api/students/:id', (req, res) => {
    students = students.filter(s => s.id != req.params.id);
    res.json({ success: true });
});

// ============ CLASSES ENDPOINTS ============
let classes = [];

app.get('/api/classes', (req, res) => res.json(classes));

app.post('/api/classes', (req, res) => {
    const newClass = { id: Date.now(), ...req.body };
    classes.push(newClass);
    res.status(201).json(newClass);
});

app.delete('/api/classes/:id', (req, res) => {
    classes = classes.filter(c => c.id != req.params.id);
    res.json({ success: true });
});

// ============ TIMETABLE ENDPOINTS ============
let timetables = [];

app.get('/api/timetable/:classId', (req, res) => {
    const filtered = timetables.filter(t => t.classId == req.params.classId);
    res.json(filtered);
});

app.post('/api/timetable', (req, res) => {
    const newEntry = { id: Date.now(), ...req.body };
    timetables.push(newEntry);
    res.status(201).json(newEntry);
});

app.delete('/api/timetable/:id', (req, res) => {
    timetables = timetables.filter(t => t.id != req.params.id);
    res.json({ success: true });
});

// ============ PARENT ENDPOINTS ============
let parents = [];

app.post('/api/parents/generate', (req, res) => {
    const parentCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newParent = { id: Date.now(), parentCode, ...req.body };
    parents.push(newParent);
    res.json({ success: true, parentCode });
});

app.post('/api/parents/login', (req, res) => {
    const { parentCode } = req.body;
    const parent = parents.find(p => p.parentCode === parentCode);
    if (!parent) return res.status(401).json({ error: 'Invalid code' });
    res.json({ success: true, parent });
});

app.get('/api/parents/:parentCode/student', (req, res) => {
    const parent = parents.find(p => p.parentCode === req.params.parentCode);
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    const student = students.find(s => s.id == parent.studentId);
    res.json({ success: true, student: student || null });
});

app.get('/api/parents/:parentCode/results', (req, res) => {
    res.json({ success: true, results: [] });
});

// ============ RESULTS ENDPOINTS ============
let results = [];

app.post('/api/results', (req, res) => {
    const newResult = { id: Date.now(), ...req.body };
    results.push(newResult);
    res.json({ success: true });
});

app.get('/api/students/:studentId/results', (req, res) => {
    const filtered = results.filter(r => r.studentId == req.params.studentId);
    res.json(filtered);
});

// ============ SEND EMAIL/SMS ============
app.post('/api/send-results', (req, res) => {
    console.log('Email would be sent to:', req.body.student?.email);
    res.json({ success: true });
});

app.post('/api/send-sms', (req, res) => {
    console.log('SMS would be sent to:', req.body.student?.phone);
    res.json({ success: true });
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Admin: admin / admin123`);
    console.log(`✅ Teacher: teacher / teacher123`);
});
EOFcd ~/student-system/backend
cat > server_minimal.js << 'EOF'
const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

// ============ MOCK DATABASE ============
let students = [];
let users = [
    { id: 1, username: "admin", password: "YWRtaW4xMjM=", role: "admin", isApproved: true, fullName: "Admin Mkuu" },
    { id: 2, username: "teacher", password: "dGVhY2hlcjEyMw==", role: "user", isApproved: true, fullName: "Mwalimu Juma" }
];

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

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = Buffer.from(password).toString('base64');
    const user = users.find(u => u.username === username && u.password === hashedPassword);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({ 
        success: true, 
        user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            isApproved: user.isApproved
        }
    });
});

app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName, phone } = req.body;
    
    if (users.find(u => u.username === username)) {
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
        isApproved: false
    };
    users.push(newUser);
    res.json({ success: true, message: 'Registration successful! Please wait for admin approval.' });
});

app.get('/api/users', (req, res) => {
    const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        role: u.role,
        isApproved: u.isApproved
    }));
    res.json(safeUsers);
});

app.put('/api/users/:id/approve', (req, res) => {
    const user = users.find(u => u.id == req.params.id);
    if (user) {
        user.isApproved = true;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.delete('/api/users/:id', (req, res) => {
    users = users.filter(u => u.id != req.params.id);
    res.json({ success: true });
});

// ============ STUDENT ENDPOINTS ============

app.get('/api/students', (req, res) => {
    res.json(students);
});

app.get('/api/students/:id', (req, res) => {
    const student = students.find(s => s.id == req.params.id);
    if (!student) return res.status(404).json({ error: 'Not found' });
    res.json(student);
});

app.post('/api/students', (req, res) => {
    const newStudent = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
    students.push(newStudent);
    res.status(201).json(newStudent);
});

app.put('/api/students/:id', (req, res) => {
    const index = students.findIndex(s => s.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    students[index] = { ...students[index], ...req.body };
    res.json(students[index]);
});

app.delete('/api/students/:id', (req, res) => {
    students = students.filter(s => s.id != req.params.id);
    res.json({ success: true });
});

// ============ CLASSES ENDPOINTS ============
let classes = [];

app.get('/api/classes', (req, res) => res.json(classes));

app.post('/api/classes', (req, res) => {
    const newClass = { id: Date.now(), ...req.body };
    classes.push(newClass);
    res.status(201).json(newClass);
});

app.delete('/api/classes/:id', (req, res) => {
    classes = classes.filter(c => c.id != req.params.id);
    res.json({ success: true });
});

// ============ TIMETABLE ENDPOINTS ============
let timetables = [];

app.get('/api/timetable/:classId', (req, res) => {
    const filtered = timetables.filter(t => t.classId == req.params.classId);
    res.json(filtered);
});

app.post('/api/timetable', (req, res) => {
    const newEntry = { id: Date.now(), ...req.body };
    timetables.push(newEntry);
    res.status(201).json(newEntry);
});

app.delete('/api/timetable/:id', (req, res) => {
    timetables = timetables.filter(t => t.id != req.params.id);
    res.json({ success: true });
});

// ============ PARENT ENDPOINTS ============
let parents = [];

app.post('/api/parents/generate', (req, res) => {
    const parentCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newParent = { id: Date.now(), parentCode, ...req.body };
    parents.push(newParent);
    res.json({ success: true, parentCode });
});

app.post('/api/parents/login', (req, res) => {
    const { parentCode } = req.body;
    const parent = parents.find(p => p.parentCode === parentCode);
    if (!parent) return res.status(401).json({ error: 'Invalid code' });
    res.json({ success: true, parent });
});

app.get('/api/parents/:parentCode/student', (req, res) => {
    const parent = parents.find(p => p.parentCode === req.params.parentCode);
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    const student = students.find(s => s.id == parent.studentId);
    res.json({ success: true, student: student || null });
});

app.get('/api/parents/:parentCode/results', (req, res) => {
    res.json({ success: true, results: [] });
});

// ============ RESULTS ENDPOINTS ============
let results = [];

app.post('/api/results', (req, res) => {
    const newResult = { id: Date.now(), ...req.body };
    results.push(newResult);
    res.json({ success: true });
});

app.get('/api/students/:studentId/results', (req, res) => {
    const filtered = results.filter(r => r.studentId == req.params.studentId);
    res.json(filtered);
});

// ============ SEND EMAIL/SMS ============
app.post('/api/send-results', (req, res) => {
    console.log('Email would be sent to:', req.body.student?.email);
    res.json({ success: true });
});

app.post('/api/send-sms', (req, res) => {
    console.log('SMS would be sent to:', req.body.student?.phone);
    res.json({ success: true });
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Admin: admin / admin123`);
    console.log(`✅ Teacher: teacher / teacher123`);
});
