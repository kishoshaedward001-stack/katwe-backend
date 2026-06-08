const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============ DATABASE (In-memory kwa sasa) ============
let students = [];
let users = [
    { id: 1, username: "admin", password: "YWRtaW4xMjM=", role: "admin", isApproved: true, fullName: "Admin Mkuu" },
    { id: 2, username: "teacher", password: "dGVhY2hlcjEyMw==", role: "user", isApproved: true, fullName: "Mwalimu Juma" }
];
let classes = [];
let timetables = [];
let parents = [];
let results = [];
let announcements = []; // Matangazo

// ============ SAMPLE ANNOUNCEMENTS ============
announcements.push({
    id: 1,
    title: "Karibu Shule",
    content: "Karibu wanafunzi wote mwaka wa masomo 2026. Mwaka huu tunaanza rasmi tarehe 15 Januari.",
    author: "Admin Mkuu",
    priority: "high",
    imageUrl: "",
    createdAt: new Date().toISOString()
});

// ============ UPLOAD PHOTO (Mock) ============
app.post('/api/upload-photo', (req, res) => {
    res.json({ 
        success: true, 
        imageUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
    });
});

// ============ UPLOAD ANNOUNCEMENT IMAGE ============
app.post('/api/upload-announcement-image', (req, res) => {
    // Mock upload - returns a placeholder image
    res.json({ 
        success: true, 
        imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500'
    });
});

// ============ ANNOUNCEMENTS ENDPOINTS ============

// Get all announcements
app.get('/api/announcements', (req, res) => {
    // Sort by newest first
    const sorted = [...announcements].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sorted);
});

// Get single announcement
app.get('/api/announcements/:id', (req, res) => {
    const announcement = announcements.find(a => a.id == req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Not found' });
    res.json(announcement);
});

// Create announcement (admin only)
app.post('/api/announcements', (req, res) => {
    const { title, content, author, priority, imageUrl } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const newAnnouncement = {
        id: Date.now(),
        title,
        content,
        author: author || 'Admin',
        priority: priority || 'medium',
        imageUrl: imageUrl || '',
        createdAt: new Date().toISOString()
    };
    
    announcements.push(newAnnouncement);
    res.status(201).json({ success: true, announcement: newAnnouncement });
});

// Update announcement (admin only)
app.put('/api/announcements/:id', (req, res) => {
    const index = announcements.findIndex(a => a.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    
    announcements[index] = { ...announcements[index], ...req.body };
    res.json({ success: true, announcement: announcements[index] });
});

// Delete announcement (admin only)
app.delete('/api/announcements/:id', (req, res) => {
    announcements = announcements.filter(a => a.id != req.params.id);
    res.json({ success: true });
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
    const parent = parents.find(p => p.parentCode === req.params.parentCode);
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    const studentResults = results.filter(r => r.studentId == parent.studentId);
    res.json({ success: true, results: studentResults });
});

// ============ RESULTS ENDPOINTS ============

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
    console.log('📧 Email would be sent to:', req.body.student?.email);
    res.json({ success: true });
});

app.post('/api/send-sms', (req, res) => {
    console.log('📱 SMS would be sent to:', req.body.student?.phone);
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
    console.log(`✅ Announcements endpoints ready`);
});
