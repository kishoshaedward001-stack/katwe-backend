const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

// SQLite database
const db = new sqlite3.Database('./katwe_school.db');

// Create tables
db.serialize(() => {
    // Students table
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        class TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        photo TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullName TEXT,
        role TEXT DEFAULT 'user',
        isApproved INTEGER DEFAULT 1
    )`);
    
    // Add default users (admin and teacher)
    db.run(`INSERT OR IGNORE INTO users (username, email, password, fullName, role, isApproved) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
            ['admin', 'admin@katwe.edu', 'YWRtaW4xMjM=', 'Admin Mkuu', 'admin', 1]);
    
    db.run(`INSERT OR IGNORE INTO users (username, email, password, fullName, role, isApproved) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
            ['teacher', 'teacher@katwe.edu', 'dGVhY2hlcjEyMw==', 'Mwalimu Juma', 'user', 1]);
    
    console.log('✅ Database and tables ready');
});

// ============ AUTH ENDPOINTS ============

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = Buffer.from(password).toString('base64');
    
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, hashedPassword], (err, user) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
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
});

// Register
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName, phone } = req.body;
    const hashedPassword = Buffer.from(password).toString('base64');
    
    db.run(
        `INSERT INTO users (username, email, password, fullName, phone, role, isApproved) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, email, hashedPassword, fullName, phone, 'user', 0],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Username or email already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: 'Registration successful! Please wait for admin approval.' });
        }
    );
});

// Get all users (admin only)
app.get('/api/users', (req, res) => {
    db.all('SELECT id, username, email, fullName, phone, role, isApproved, createdAt FROM users ORDER BY createdAt DESC', 
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
});

// Approve user (admin only)
app.put('/api/users/:id/approve', (req, res) => {
    db.run('UPDATE users SET isApproved = 1 WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Delete user (admin only)
app.delete('/api/users/:id', (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============ STUDENT ENDPOINTS ============

// Get all students
app.get('/api/students', (req, res) => {
    db.all('SELECT * FROM students ORDER BY createdAt DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create student
app.post('/api/students', (req, res) => {
    const { fullName, age, gender, class: studentClass, phone, email, photo } = req.body;
    db.run(
        'INSERT INTO students (fullName, age, gender, class, phone, email, photo) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [fullName, age, gender, studentClass, phone, email, photo],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Update student
app.put('/api/students/:id', (req, res) => {
    const { fullName, age, gender, class: studentClass, phone, email, photo } = req.body;
    db.run(
        'UPDATE students SET fullName=?, age=?, gender=?, class=?, phone=?, email=?, photo=? WHERE id=?',
        [fullName, age, gender, studentClass, phone, email, photo, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Student updated' });
        }
    );
});

// Delete student
app.delete('/api/students/:id', (req, res) => {
    db.run('DELETE FROM students WHERE id=?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Student deleted' });
    });
});

// ============ PARENT ENDPOINTS ============

// Generate parent code
app.post('/api/parents/generate', (req, res) => {
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

// Parent login
app.post('/api/parents/login', (req, res) => {
    const { parentCode } = req.body;
    
    db.get(
        `SELECT p.*, s.fullName as studentName, s.class, s.photo 
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Database: SQLite (katwe_school.db)`);
    console.log(`✅ Admin: admin / admin123`);
    console.log(`✅ Teacher: teacher / teacher123`);
});
