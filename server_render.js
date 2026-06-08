const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// JSON file as database
const DB_FILE = path.join(__dirname, 'db.json');

// Initialize database
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], students: [] }));
}

// Helper to read/write JSON
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// Initialize default users
let db = readDB();
if (db.users.length === 0) {
    db.users = [
        { id: 1, username: 'admin', password: 'YWRtaW4xMjM=', fullName: 'Admin Mkuu', role: 'admin', isApproved: true },
        { id: 2, username: 'teacher', password: 'dGVhY2hlcjEyMw==', fullName: 'Mwalimu Juma', role: 'user', isApproved: true }
    ];
    writeDB(db);
}

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = Buffer.from(password).toString('base64');
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === hashedPassword);
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.isApproved) return res.status(401).json({ error: 'Account not approved' });
    
    res.json({ success: true, user });
});

// Get students
app.get('/api/students', (req, res) => {
    const db = readDB();
    res.json(db.students || []);
});

// Create student
app.post('/api/students', (req, res) => {
    const db = readDB();
    const newStudent = { id: Date.now(), ...req.body, createdAt: new Date() };
    db.students.push(newStudent);
    writeDB(db);
    res.status(201).json(newStudent);
});

// Update student
app.put('/api/students/:id', (req, res) => {
    const db = readDB();
    const index = db.students.findIndex(s => s.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
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

// Register
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName } = req.body;
    const db = readDB();
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username exists' });
    }
    const newUser = {
        id: Date.now(),
        username,
        email,
        password: Buffer.from(password).toString('base64'),
        fullName,
        role: 'user',
        isApproved: false
    };
    db.users.push(newUser);
    writeDB(db);
    res.json({ success: true, message: 'Registered! Wait for approval.' });
});

// Get users (admin)
app.get('/api/users', (req, res) => {
    const db = readDB();
    res.json(db.users);
});

// Approve user
app.put('/api/users/:id/approve', (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.id == req.params.id);
    if (user) user.isApproved = true;
    writeDB(db);
    res.json({ success: true });
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
    let db = readDB();
    db.users = db.users.filter(u => u.id != req.params.id);
    writeDB(db);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Admin: admin / admin123`);
    console.log(`✅ Teacher: teacher / teacher123`);
});
