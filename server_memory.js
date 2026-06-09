const express = require('express');
const cors = require('cors');
const compression = require('compression');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory database
let data = {
    students: [],
    users: [
        { id: 1, username: "admin", password: "YWRtaW4xMjM=", role: "admin", isApproved: true, fullName: "Admin Mkuu" },
        { id: 2, username: "teacher", password: "dGVhY2hlcjEyMw==", role: "user", isApproved: true, fullName: "Mwalimu Juma" }
    ],
    classes: [],
    timetables: [],
    parents: [],
    results: [],
    announcements: []
};

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get students
app.get('/api/students', (req, res) => {
    res.json(data.students);
});

// Create student
app.post('/api/students', (req, res) => {
    const newStudent = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
    data.students.push(newStudent);
    res.status(201).json(newStudent);
});

// Update student
app.put('/api/students/:id', (req, res) => {
    const index = data.students.findIndex(s => s.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    data.students[index] = { ...data.students[index], ...req.body };
    res.json(data.students[index]);
});

// Delete student
app.delete('/api/students/:id', (req, res) => {
    data.students = data.students.filter(s => s.id != req.params.id);
    res.json({ success: true });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = Buffer.from(password).toString('base64');
    const user = data.users.find(u => u.username === username && u.password === hashedPassword);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role } });
});

// Register
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName, phone } = req.body;
    if (data.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username exists' });
    }
    data.users.push({
        id: Date.now(), username, email, password: Buffer.from(password).toString('base64'),
        fullName: fullName || '', phone: phone || '', role: 'user', isApproved: false
    });
    res.json({ success: true, message: 'Registered! Wait for approval.' });
});

// Get users
app.get('/api/users', (req, res) => {
    res.json(data.users.map(u => ({ id: u.id, username: u.username, email: u.email, fullName: u.fullName, role: u.role, isApproved: u.isApproved })));
});

// Approve user
app.put('/api/users/:id/approve', (req, res) => {
    const user = data.users.find(u => u.id == req.params.id);
    if (user) user.isApproved = true;
    res.json({ success: true });
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
    data.users = data.users.filter(u => u.id != req.params.id);
    res.json({ success: true });
});

// Classes
app.get('/api/classes', (req, res) => res.json(data.classes));
app.post('/api/classes', (req, res) => {
    const newClass = { id: Date.now(), ...req.body };
    data.classes.push(newClass);
    res.status(201).json(newClass);
});
app.delete('/api/classes/:id', (req, res) => {
    data.classes = data.classes.filter(c => c.id != req.params.id);
    res.json({ success: true });
});

// Timetable
app.get('/api/timetable/:classId', (req, res) => {
    res.json(data.timetables.filter(t => t.classId == req.params.classId));
});
app.post('/api/timetable', (req, res) => {
    const newEntry = { id: Date.now(), ...req.body };
    data.timetables.push(newEntry);
    res.status(201).json(newEntry);
});
app.delete('/api/timetable/:id', (req, res) => {
    data.timetables = data.timetables.filter(t => t.id != req.params.id);
    res.json({ success: true });
});

// Parents
app.post('/api/parents/generate', (req, res) => {
    const parentCode = Math.floor(100000 + Math.random() * 900000).toString();
    data.parents.push({ id: Date.now(), parentCode, ...req.body });
    res.json({ success: true, parentCode });
});
app.post('/api/parents/login', (req, res) => {
    const parent = data.parents.find(p => p.parentCode === req.body.parentCode);
    if (!parent) return res.status(401).json({ error: 'Invalid code' });
    const student = data.students.find(s => s.id == parent.studentId);
    res.json({ success: true, parent: { ...parent, studentName: student?.fullName } });
});
app.get('/api/parents/:parentCode/student', (req, res) => {
    const parent = data.parents.find(p => p.parentCode === req.params.parentCode);
    if (!parent) return res.status(404).json({ error: 'Not found' });
    const student = data.students.find(s => s.id == parent.studentId);
    res.json({ success: true, student: student || null });
});
app.get('/api/parents/:parentCode/results', (req, res) => {
    const parent = data.parents.find(p => p.parentCode === req.params.parentCode);
    if (!parent) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, results: data.results.filter(r => r.studentId == parent.studentId) });
});

// Results
app.post('/api/results', (req, res) => {
    data.results.push({ id: Date.now(), ...req.body });
    res.json({ success: true });
});
app.get('/api/students/:studentId/results', (req, res) => {
    res.json(data.results.filter(r => r.studentId == req.params.studentId));
});

// Announcements
app.get('/api/announcements', (req, res) => res.json(data.announcements));
app.post('/api/announcements', (req, res) => {
    const newAnn = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
    data.announcements.unshift(newAnn);
    res.status(201).json(newAnn);
});
app.delete('/api/announcements/:id', (req, res) => {
    data.announcements = data.announcements.filter(a => a.id != req.params.id);
    res.json({ success: true });
});

// Mock uploads
app.post('/api/upload-photo', (req, res) => {
    res.json({ success: true, imageUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' });
});
app.post('/api/upload-announcement-image', (req, res) => {
    res.json({ success: true, imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500' });
});
app.post('/api/send-results', (req, res) => res.json({ success: true }));
app.post('/api/send-sms', (req, res) => res.json({ success: true }));

// PDF Reports
app.get('/api/report/student/:id', (req, res) => {
    const student = data.students.find(s => s.id == req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'PDF would be generated here', student });
});
app.get('/api/report/all-students', (req, res) => res.json({ message: 'All students PDF' }));
app.get('/api/report/class/:className', (req, res) => res.json({ message: 'Class PDF' }));

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT} (in-memory mode)`);
    console.log(`✅ Admin: admin / admin123`);
    console.log(`✅ Teacher: teacher / teacher123`);
});
