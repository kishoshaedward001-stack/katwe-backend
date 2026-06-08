const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DATA_FILE = path.join(__dirname, 'data.json');

// Load data from file
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

// Load existing data
if (fs.existsSync(DATA_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(DATA_FILE));
        data = { ...data, ...saved };
        console.log('✅ Data loaded from file');
    } catch(e) { console.log('No saved data'); }
}

// Save data function
const saveData = () => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// Auto-save after operations
const withSave = async (fn, req, res) => {
    const result = await fn(req, res);
    saveData();
    return result;
};

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Announcements
app.get('/api/announcements', (req, res) => {
    res.json(data.announcements.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/announcements', (req, res) => {
    const { title, content, author, priority, imageUrl } = req.body;
    const newAnnouncement = {
        id: Date.now(),
        title,
        content,
        author: author || 'Admin',
        priority: priority || 'medium',
        imageUrl: imageUrl || '',
        createdAt: new Date().toISOString()
    };
    data.announcements.unshift(newAnnouncement);
    saveData();
    res.status(201).json({ success: true, announcement: newAnnouncement });
});

app.delete('/api/announcements/:id', (req, res) => {
    data.announcements = data.announcements.filter(a => a.id != req.params.id);
    saveData();
    res.json({ success: true });
});

// Auth
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = Buffer.from(password).toString('base64');
    const user = data.users.find(u => u.username === username && u.password === hashedPassword);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ 
        success: true, 
        user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, isApproved: user.isApproved }
    });
});

app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName, phone } = req.body;
    if (data.users.find(u => u.username === username)) {
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
    data.users.push(newUser);
    saveData();
    res.json({ success: true, message: 'Registration successful!' });
});

app.get('/api/users', (req, res) => {
    const safeUsers = data.users.map(u => ({
        id: u.id, username: u.username, email: u.email, fullName: u.fullName,
        phone: u.phone, role: u.role, isApproved: u.isApproved
    }));
    res.json(safeUsers);
});

app.put('/api/users/:id/approve', (req, res) => {
    const user = data.users.find(u => u.id == req.params.id);
    if (user) user.isApproved = true;
    saveData();
    res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
    data.users = data.users.filter(u => u.id != req.params.id);
    saveData();
    res.json({ success: true });
});

// Students
app.get('/api/students', (req, res) => res.json(data.students));

app.post('/api/students', (req, res) => {
    const newStudent = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
    data.students.push(newStudent);
    saveData();
    res.status(201).json(newStudent);
});

app.put('/api/students/:id', (req, res) => {
    const index = data.students.findIndex(s => s.id == req.params.id);
    if (index !== -1) data.students[index] = { ...data.students[index], ...req.body };
    saveData();
    res.json({ success: true });
});

app.delete('/api/students/:id', (req, res) => {
    data.students = data.students.filter(s => s.id != req.params.id);
    saveData();
    res.json({ success: true });
});

// Classes
app.get('/api/classes', (req, res) => res.json(data.classes));

app.post('/api/classes', (req, res) => {
    const newClass = { id: Date.now(), ...req.body };
    data.classes.push(newClass);
    saveData();
    res.status(201).json(newClass);
});

app.delete('/api/classes/:id', (req, res) => {
    data.classes = data.classes.filter(c => c.id != req.params.id);
    saveData();
    res.json({ success: true });
});

// Timetable
app.get('/api/timetable/:classId', (req, res) => {
    const filtered = data.timetables.filter(t => t.classId == req.params.classId);
    res.json(filtered);
});

app.post('/api/timetable', (req, res) => {
    const newEntry = { id: Date.now(), ...req.body };
    data.timetables.push(newEntry);
    saveData();
    res.status(201).json(newEntry);
});

app.delete('/api/timetable/:id', (req, res) => {
    data.timetables = data.timetables.filter(t => t.id != req.params.id);
    saveData();
    res.json({ success: true });
});

// Parents
app.post('/api/parents/generate', (req, res) => {
    const parentCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newParent = { id: Date.now(), parentCode, ...req.body };
    data.parents.push(newParent);
    saveData();
    res.json({ success: true, parentCode });
});

app.post('/api/parents/login', (req, res) => {
    const parent = data.parents.find(p => p.parentCode === req.body.parentCode);
    if (!parent) return res.status(401).json({ error: 'Invalid code' });
    const student = data.students.find(s => s.id == parent.studentId);
    res.json({ success: true, parent: { ...parent, studentName: student?.fullName, studentCourse: student?.course } });
});

app.get('/api/parents/:parentCode/student', (req, res) => {
    const parent = data.parents.find(p => p.parentCode === req.params.parentCode);
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    const student = data.students.find(s => s.id == parent.studentId);
    res.json({ success: true, student: student || null });
});

app.get('/api/parents/:parentCode/results', (req, res) => {
    const parent = data.parents.find(p => p.parentCode === req.params.parentCode);
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    const studentResults = data.results.filter(r => r.studentId == parent.studentId);
    res.json({ success: true, results: studentResults });
});

// Results
app.post('/api/results', (req, res) => {
    const newResult = { id: Date.now(), ...req.body };
    data.results.push(newResult);
    saveData();
    res.json({ success: true });
});

app.get('/api/students/:studentId/results', (req, res) => {
    const filtered = data.results.filter(r => r.studentId == req.params.studentId);
    res.json(filtered);
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

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Data saved to: ${DATA_FILE}`);
    console.log(`✅ Admin: admin / admin123`);
    console.log(`✅ Teacher: teacher / teacher123`);
});
