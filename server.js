const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');
const { Resend } = require('resend');
const africastalking = require('africastalking');
const PDFDocument = require('pdfkit');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5003;
const JWT_SECRET = process.env.JWT_SECRET || 'katwe_super_secret_key';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============ SQLITE DATABASE ============
const db = new sqlite3.Database('./katwe_school.db');

// ============ CREATE TABLES ============
db.serialize(() => {
    // Users table (with role)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullName TEXT,
        phone TEXT,
        role TEXT DEFAULT 'user',
        isApproved INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating users table:', err);
        else console.log('✅ Users table ready');
    });

    // Students table
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
    )`, (err) => {
        if (err) console.error('Error creating students table:', err);
        else console.log('✅ Students table ready');
    });

    // Parents table
    db.run(`CREATE TABLE IF NOT EXISTS parents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentCode TEXT UNIQUE NOT NULL,
        parentName TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        studentId INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Error creating parents table:', err);
        else console.log('✅ Parents table ready');
    });

    // Results table
    db.run(`CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId INTEGER,
        subject1 TEXT, grade1 TEXT,
        subject2 TEXT, grade2 TEXT,
        subject3 TEXT, grade3 TEXT,
        subject4 TEXT, grade4 TEXT,
        subject5 TEXT, grade5 TEXT,
        subject6 TEXT, grade6 TEXT,
        subject7 TEXT, grade7 TEXT,
        average REAL DEFAULT 0,
        division TEXT DEFAULT '',
        remarks TEXT,
        term TEXT,
        year INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error('Error creating results table:', err);
        else console.log('✅ Results table ready');
    });

    // Classes table
    db.run(`CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        className TEXT UNIQUE NOT NULL,
        description TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating classes table:', err);
        else console.log('✅ Classes table ready');
    });

    // Timetables table
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
    )`, (err) => {
        if (err) console.error('Error creating timetables table:', err);
        else console.log('✅ Timetables table ready');
    });

    // Announcements table
    db.run(`CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT,
        priority TEXT DEFAULT 'medium',
        imageUrl TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Error creating announcements table:', err);
        else console.log('✅ Announcements table ready');
    });
});

// ============ HELPER FUNCTIONS ============
const getGradePoints = (grade) => {
    const points = { 'A': 4.0, 'B+': 3.5, 'B': 3.0, 'C+': 2.5, 'C': 2.0, 'D': 1.0, 'F': 0.0 };
    return points[grade] || 0;
};

const calculateAverage = (grades) => {
    let total = 0, count = 0;
    const gradeList = [grades.grade1, grades.grade2, grades.grade3, grades.grade4, grades.grade5, grades.grade6, grades.grade7];
    gradeList.forEach(g => {
        if (g && g !== '') {
            total += getGradePoints(g);
            count++;
        }
    });
    return count > 0 ? (total / count) : 0;
};

const calculateDivision = (avg) => {
    if (avg >= 3.5) return 'I';
    if (avg >= 2.5) return 'II';
    if (avg >= 1.5) return 'III';
    return 'IV';
};

// ============ CLOUDINARY ============
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dtfgbybqv',
    api_key: process.env.CLOUDINARY_API_KEY || '935441121923263',
    api_secret: process.env.CLOUDINARY_API_SECRET || '2BTkkMm2ialzU0W7mTqSsq5MR-c'
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
    console.log('✅ SMS initialized');
}

let resend = null;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Email initialized');
}

// ============ DEFAULT USERS ============
db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) {
        console.error('Error checking users:', err);
        return;
    }
    if (row.count === 0) {
        // Create default admin user
        const adminPassword = Buffer.from('admin123').toString('base64');
        db.run(
            `INSERT INTO users (username, email, password, fullName, phone, role, isApproved) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['admin', 'admin@katwe.edu', adminPassword, 'Admin Mkuu', '0712345678', 'admin', 1],
            (err) => {
                if (err) console.error('Error creating admin:', err);
                else console.log('✅ Default admin created');
            }
        );

        // Create default user
        const userPassword = Buffer.from('user123').toString('base64');
        db.run(
            `INSERT INTO users (username, email, password, fullName, phone, role, isApproved) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['user', 'user@katwe.edu', userPassword, 'Mwalimu Juma', '0712345679', 'user', 1],
            (err) => {
                if (err) console.error('Error creating default user:', err);
                else console.log('✅ Default user created');
            }
        );
    }
});

// ============ AUTH ENDPOINTS ============

// REGISTER - Create new account
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName, phone } = req.body;
    
    if (!username || !email || !password || !fullName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user exists
    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, row) => {
        if (err) {
            console.error('Registration error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (row) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        
        // Hash password (base64 for simplicity - use bcrypt in production)
        const hashedPassword = Buffer.from(password).toString('base64');
        
        db.run(
            `INSERT INTO users (username, email, password, fullName, phone, role, isApproved) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, fullName, phone || '', 'user', 1],
            function(err) {
                if (err) {
                    console.error('Registration error:', err);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ 
                    success: true, 
                    message: 'Registration successful!', 
                    user: { 
                        id: this.lastID, 
                        username, 
                        email, 
                        fullName, 
                        role: 'user' 
                    }
                });
            }
        );
    });
});

// LOGIN - Authenticate user
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    const hashedPassword = Buffer.from(password).toString('base64');
    
    db.get(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, hashedPassword],
        (err, user) => {
            if (err) {
                console.error('Login error:', err);
                return res.status(500).json({ error: err.message });
            }
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            // Check if user is approved
            if (!user.isApproved) {
                return res.status(401).json({ error: 'Account pending approval' });
            }
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: user.fullName,
                    role: user.role || 'user',
                    email: user.email,
                    phone: user.phone,
                    isApproved: user.isApproved
                }
            });
        }
    );
});

// GET all users (Admin only)
app.get('/api/users', (req, res) => {
    db.all('SELECT id, username, email, fullName, phone, role, isApproved, createdAt FROM users ORDER BY createdAt DESC', (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Approve user (Admin only)
app.put('/api/users/:id/approve', (req, res) => {
    db.run('UPDATE users SET isApproved = 1 WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Error approving user:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// Delete user (Admin only)
app.delete('/api/users/:id', (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Error deleting user:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// ============ STUDENT ENDPOINTS ============

// GET all students
app.get('/api/students', (req, res) => {
    db.all('SELECT * FROM students ORDER BY createdAt DESC', (err, rows) => {
        if (err) {
            console.error('Error fetching students:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// GET single student
app.get('/api/students/:id', (req, res) => {
    db.get('SELECT * FROM students WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            console.error('Error fetching student:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Student not found' });
        }
        res.json(row);
    });
});

// POST new student
app.post('/api/students', (req, res) => {
    const { fullName, age, gender, course, phone, email, photo } = req.body;
    
    if (!fullName || !age || !gender || !course) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    db.run(
        `INSERT INTO students (fullName, age, gender, course, phone, email, photo) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [fullName, age, gender, course, phone || '', email || '', photo || ''],
        function(err) {
            if (err) {
                console.error('Error creating student:', err);
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ 
                id: this.lastID, 
                fullName, age, gender, course, phone, email, photo 
            });
        }
    );
});

// PUT update student
app.put('/api/students/:id', (req, res) => {
    const { fullName, age, gender, course, phone, email, photo } = req.body;
    
    db.run(
        `UPDATE students SET fullName=?, age=?, gender=?, course=?, phone=?, email=?, photo=? WHERE id=?`,
        [fullName, age, gender, course, phone, email, photo, req.params.id],
        function(err) {
            if (err) {
                console.error('Error updating student:', err);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Student not found' });
            }
            res.json({ success: true });
        }
    );
});

// DELETE student
app.delete('/api/students/:id', (req, res) => {
    db.run('DELETE FROM students WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Error deleting student:', err);
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        res.json({ success: true });
    });
});

// ============ PARENT ENDPOINTS ============

// Generate parent code
app.post('/api/parents/generate', (req, res) => {
    const { studentId, parentName, phone, email } = req.body;
    
    if (!studentId || !parentName) {
        return res.status(400).json({ error: 'Student ID and parent name required' });
    }
    
    // Check if student exists
    db.get('SELECT * FROM students WHERE id = ?', [studentId], (err, student) => {
        if (err) {
            console.error('Error checking student:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        // Check if parent already exists
        db.get('SELECT * FROM parents WHERE studentId = ?', [studentId], (err, existing) => {
            if (err) {
                console.error('Error checking parent:', err);
                return res.status(500).json({ error: err.message });
            }
            if (existing) {
                return res.json({ 
                    success: true, 
                    parentCode: existing.parentCode,
                    message: 'Parent code already exists' 
                });
            }
            
            // Generate random 6-digit code
            const parentCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            db.run(
                `INSERT INTO parents (parentCode, parentName, phone, email, studentId) 
                 VALUES (?, ?, ?, ?, ?)`,
                [parentCode, parentName, phone || '', email || '', studentId],
                function(err) {
                    if (err) {
                        console.error('Error generating parent code:', err);
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({ success: true, parentCode });
                }
            );
        });
    });
});

// Parent login
app.post('/api/parents/login', (req, res) => {
    const { parentCode } = req.body;
    
    if (!parentCode) {
        return res.status(400).json({ error: 'Parent code required' });
    }
    
    db.get(
        `SELECT p.*, s.fullName as studentName, s.course, s.photo, s.age, s.gender, s.phone as studentPhone, s.email as studentEmail
         FROM parents p
         JOIN students s ON p.studentId = s.id
         WHERE p.parentCode = ?`,
        [parentCode],
        (err, result) => {
            if (err) {
                console.error('Parent login error:', err);
                return res.status(500).json({ error: err.message });
            }
            if (!result) {
                return res.status(401).json({ error: 'Invalid parent code' });
            }
            
            res.json({ 
                success: true, 
                parent: {
                    parentcode: result.parentCode,
                    parentname: result.parentName,
                    phone: result.phone,
                    email: result.email,
                    studentId: result.studentId,
                    studentName: result.studentName,
                    course: result.course,
                    photo: result.photo,
                    age: result.age,
                    gender: result.gender
                }
            });
        }
    );
});

// Get student for parent
app.get('/api/parents/:parentCode/student', (req, res) => {
    const { parentCode } = req.params;
    
    db.get(
        `SELECT s.* FROM students s
         JOIN parents p ON p.studentId = s.id
         WHERE p.parentCode = ?`,
        [parentCode],
        (err, result) => {
            if (err) {
                console.error('Error fetching student:', err);
                return res.status(500).json({ error: err.message });
            }
            if (!result) {
                return res.status(404).json({ error: 'Student not found' });
            }
            res.json({ success: true, student: result });
        }
    );
});

// Get student results for parent
app.get('/api/parents/:parentCode/results', (req, res) => {
    const { parentCode } = req.params;
    
    db.get('SELECT studentId FROM parents WHERE parentCode = ?', [parentCode], (err, parent) => {
        if (err) {
            console.error('Error finding parent:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!parent) {
            return res.status(404).json({ error: 'Parent not found' });
        }
        
        db.all(
            'SELECT * FROM results WHERE studentId = ? ORDER BY year DESC, term DESC',
            [parent.studentId],
            (err, results) => {
                if (err) {
                    console.error('Error fetching results:', err);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, results });
            }
        );
    });
});

// ============ RESULTS ENDPOINTS ============

// Save results
app.post('/api/results', (req, res) => {
    const { 
        studentId, 
        subject1, grade1, 
        subject2, grade2, 
        subject3, grade3, 
        subject4, grade4,
        subject5, grade5,
        subject6, grade6,
        subject7, grade7,
        remarks, term, year 
    } = req.body;
    
    if (!studentId) {
        return res.status(400).json({ error: 'Student ID required' });
    }
    
    // Calculate average and division
    const grades = { grade1, grade2, grade3, grade4, grade5, grade6, grade7 };
    const average = calculateAverage(grades);
    const division = calculateDivision(average);
    
    db.run(
        `INSERT INTO results (
            studentId, 
            subject1, grade1, 
            subject2, grade2, 
            subject3, grade3, 
            subject4, grade4,
            subject5, grade5,
            subject6, grade6,
            subject7, grade7,
            average, division, remarks, term, year
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            studentId, 
            subject1 || '', grade1 || '', 
            subject2 || '', grade2 || '', 
            subject3 || '', grade3 || '', 
            subject4 || '', grade4 || '',
            subject5 || '', grade5 || '',
            subject6 || '', grade6 || '',
            subject7 || '', grade7 || '',
            average, division, remarks || '', term || 'Term 1', year || new Date().getFullYear()
        ],
        function(err) {
            if (err) {
                console.error('Error saving results:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: this.lastID, average, division });
        }
    );
});

// Get results for a student
app.get('/api/students/:studentId/results', (req, res) => {
    const { studentId } = req.params;
    
    db.all(
        'SELECT * FROM results WHERE studentId = ? ORDER BY year DESC, term DESC',
        [studentId],
        (err, results) => {
            if (err) {
                console.error('Error fetching results:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json(results);
        }
    );
});

// ============ ANNOUNCEMENTS ============
app.get('/api/announcements', (req, res) => {
    db.all('SELECT * FROM announcements ORDER BY createdAt DESC', (err, rows) => {
        if (err) {
            console.error('Error fetching announcements:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/announcements', (req, res) => {
    const { title, content, author, priority, imageUrl } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content required' });
    }
    
    db.run(
        `INSERT INTO announcements (title, content, author, priority, imageUrl) 
         VALUES (?, ?, ?, ?, ?)`,
        [title, content, author || 'Admin', priority || 'medium', imageUrl || ''],
        function(err) {
            if (err) {
                console.error('Error creating announcement:', err);
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ 
                success: true, 
                id: this.lastID,
                title, content, author, priority, imageUrl 
            });
        }
    );
});

app.delete('/api/announcements/:id', (req, res) => {
    db.run('DELETE FROM announcements WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Error deleting announcement:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// ============ CLASSES & TIMETABLE ============
app.get('/api/classes', (req, res) => {
    db.all('SELECT * FROM classes ORDER BY className', (err, rows) => {
        if (err) {
            console.error('Error fetching classes:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/classes', (req, res) => {
    const { className, description } = req.body;
    
    if (!className) {
        return res.status(400).json({ error: 'Class name required' });
    }
    
    db.run(
        'INSERT INTO classes (className, description) VALUES (?, ?)',
        [className, description || ''],
        function(err) {
            if (err) {
                console.error('Error creating class:', err);
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ success: true, id: this.lastID });
        }
    );
});

app.delete('/api/classes/:id', (req, res) => {
    db.run('DELETE FROM classes WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Error deleting class:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

app.get('/api/timetable/:classId', (req, res) => {
    const { classId } = req.params;
    
    db.all(
        'SELECT * FROM timetables WHERE classId = ? ORDER BY dayOfWeek, startTime',
        [classId],
        (err, rows) => {
            if (err) {
                console.error('Error fetching timetable:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows);
        }
    );
});

app.post('/api/timetable', (req, res) => {
    const { classId, dayOfWeek, startTime, endTime, subject, teacher, room } = req.body;
    
    if (!classId || !dayOfWeek || !startTime || !endTime || !subject) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    db.run(
        `INSERT INTO timetables (classId, dayOfWeek, startTime, endTime, subject, teacher, room) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [classId, dayOfWeek, startTime, endTime, subject, teacher || '', room || ''],
        function(err) {
            if (err) {
                console.error('Error creating timetable entry:', err);
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ success: true, id: this.lastID });
        }
    );
});

app.delete('/api/timetable/:id', (req, res) => {
    db.run('DELETE FROM timetables WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Error deleting timetable entry:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// ============ UPLOAD ============
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

// ============ SEND EMAIL ============
app.post('/api/send-results', (req, res) => {
    const { student, results } = req.body;
    
    if (!student || !results || !resend) {
        return res.status(400).json({ error: 'Missing required fields or email not configured' });
    }
    
    const emailContent = `
        <h2>Katwe Secondary School - Matokeo ya Mitihani</h2>
        <p><strong>Jina:</strong> ${student.fullName}</p>
        <p><strong>Kozi:</strong> ${student.course}</p>
        <hr/>
        <h3>Matokeo:</h3>
        <ul>
            <li>${results.subject1 || 'N/A'}: ${results.grade1 || 'N/A'}</li>
            <li>${results.subject2 || 'N/A'}: ${results.grade2 || 'N/A'}</li>
            <li>${results.subject3 || 'N/A'}: ${results.grade3 || 'N/A'}</li>
            <li>${results.subject4 || 'N/A'}: ${results.grade4 || 'N/A'}</li>
            <li>${results.subject5 || 'N/A'}: ${results.grade5 || 'N/A'}</li>
            <li>${results.subject6 || 'N/A'}: ${results.grade6 || 'N/A'}</li>
            <li>${results.subject7 || 'N/A'}: ${results.grade7 || 'N/A'}</li>
            <li><strong>Average:</strong> ${results.average || 'N/A'}</li>
            <li><strong>Division:</strong> ${results.division || 'N/A'}</li>
        </ul>
        <p><strong>Maoni:</strong> ${results.remarks || 'Hakuna maoni'}</p>
        <hr/>
        <p>Asante,<br/>Katwe Secondary School</p>
    `;
    
    resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [student.email],
        subject: `Matokeo yako - ${student.fullName}`,
        html: emailContent
    }).then(() => {
        res.json({ success: true });
    }).catch((error) => {
        console.error('Email error:', error);
        res.status(500).json({ error: error.message });
    });
});

// Send email (generic)
app.post('/api/send-email', (req, res) => {
    const { to, subject, message } = req.body;
    
    if (!to || !subject || !message || !resend) {
        return res.status(400).json({ error: 'Missing required fields or email not configured' });
    }
    
    const emailContent = `
        <h2>Katwe Secondary School</h2>
        <p>${message}</p>
        <hr/>
        <p>Asante,<br/>Katwe Secondary School</p>
    `;
    
    resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [to],
        subject: subject,
        html: emailContent
    }).then(() => {
        res.json({ success: true });
    }).catch((error) => {
        console.error('Email error:', error);
        res.status(500).json({ error: error.message });
    });
});

// ============ SEND SMS ============
app.post('/api/send-sms', (req, res) => {
    const { student, results } = req.body;
    
    if (!student || !results || !sms) {
        return res.status(400).json({ error: 'Missing required fields or SMS not configured' });
    }
    
    let phoneNumber = student.phone || '';
    phoneNumber = phoneNumber.replace(/\D/g, '');
    if (phoneNumber.startsWith('0')) {
        phoneNumber = '255' + phoneNumber.substring(1);
    } else if (!phoneNumber.startsWith('255')) {
        phoneNumber = '255' + phoneNumber;
    }
    
    const smsContent = `Katwe School: ${student.fullName}, Matokeo: ${results.subject1 || 'N/A'}=${results.grade1 || 'N/A'}. ${results.remarks || 'Asante'}`;
    const finalMessage = smsContent.length > 160 ? smsContent.substring(0, 157) + '...' : smsContent;
    
    sms.send({
        to: phoneNumber,
        message: finalMessage,
        from: 'sandbox'
    }).then(() => {
        res.json({ success: true });
    }).catch((error) => {
        console.error('SMS error:', error);
        res.status(500).json({ error: error.message });
    });
});

// ============ PROGRESS CHART ============
app.get('/api/students/:id/progress', (req, res) => {
    const studentId = parseInt(req.params.id);
    
    db.get('SELECT * FROM students WHERE id = ?', [studentId], (err, student) => {
        if (err) {
            console.error('Error fetching student:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        db.all(
            'SELECT * FROM results WHERE studentId = ? ORDER BY year, term',
            [studentId],
            (err, results) => {
                if (err) {
                    console.error('Error fetching results:', err);
                    return res.status(500).json({ error: err.message });
                }
                if (results.length === 0) {
                    return res.json({ success: true, hasData: false, message: 'No results available yet' });
                }
                
                const labels = results.map(r => `${r.term} ${r.year}`);
                const averages = results.map(r => r.average || 0);
                
                const firstAvg = averages[0] || 0;
                const lastAvg = averages[averages.length - 1] || 0;
                const trend = lastAvg > firstAvg ? 'improving' : (lastAvg < firstAvg ? 'declining' : 'stable');
                
                res.json({
                    success: true,
                    hasData: true,
                    progress: {
                        labels,
                        averages,
                        trend,
                        totalExams: results.length,
                        bestAverage: Math.max(...averages),
                        worstAverage: Math.min(...averages),
                        currentAverage: averages[averages.length - 1] || 0,
                        currentDivision: results[results.length - 1]?.division || 'N/A'
                    }
                });
            }
        );
    });
});

// ============ PDF REPORTS ============
app.get('/api/report/student/:id', (req, res) => {
    const studentId = parseInt(req.params.id);
    
    db.get('SELECT * FROM students WHERE id = ?', [studentId], (err, student) => {
        if (err) {
            console.error('Error fetching student:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        db.all(
            'SELECT * FROM results WHERE studentId = ? ORDER BY year DESC, term DESC LIMIT 1',
            [studentId],
            (err, results) => {
                if (err) {
                    console.error('Error fetching results:', err);
                    return res.status(500).json({ error: err.message });
                }
                
                const latestResult = results[0] || null;
                const doc = new PDFDocument({ margin: 50 });
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=report_${student.fullName.replace(/\s/g, '_')}.pdf`);
                doc.pipe(res);
                
                // Header
                doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e3c72')
                   .text('KATWE SECONDARY SCHOOL', { align: 'center' });
                doc.fontSize(14).fillColor('#666')
                   .text('Student Academic Report', { align: 'center' });
                doc.moveDown();
                
                // Student Info
                doc.fontSize(12).font('Helvetica-Bold').fillColor('#333')
                   .text('STUDENT INFORMATION', { underline: true });
                doc.fontSize(10).font('Helvetica').fillColor('#555')
                   .text(`Name: ${student.fullName}`)
                   .text(`Age: ${student.age} years`)
                   .text(`Gender: ${student.gender === 'MALE' ? 'Male' : 'Female'}`)
                   .text(`Course: ${student.course}`)
                   .text(`Phone: ${student.phone || 'N/A'}`)
                   .text(`Email: ${student.email || 'N/A'}`);
                doc.moveDown();
                
                // Results
                doc.fontSize(12).font('Helvetica-Bold').fillColor('#333')
                   .text('ACADEMIC RESULTS', { underline: true });
                
                if (latestResult) {
                    const grades = [
                        { subject: latestResult.subject1 || '', grade: latestResult.grade1 || '' },
                        { subject: latestResult.subject2 || '', grade: latestResult.grade2 || '' },
                        { subject: latestResult.subject3 || '', grade: latestResult.grade3 || '' },
                        { subject: latestResult.subject4 || '', grade: latestResult.grade4 || '' },
                        { subject: latestResult.subject5 || '', grade: latestResult.grade5 || '' },
                        { subject: latestResult.subject6 || '', grade: latestResult.grade6 || '' },
                        { subject: latestResult.subject7 || '', grade: latestResult.grade7 || '' }
                    ];
                    
                    let y = doc.y;
                    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3c72')
                       .text('Subject', 50, y).text('Grade', 250, y);
                    y += 20;
                    doc.font('Helvetica');
                    
                    grades.forEach(g => {
                        if (g.subject !== 'N/A') {
                            doc.fillColor('#555').text(g.subject, 50, y).text(g.grade, 250, y);
                            y += 20;
                        }
                    });
                    
                    doc.moveDown();
                    doc.fontSize(10)
                       .text(`Average: ${latestResult.average || 'N/A'}`, 50, y)
                       .text(`Division: ${latestResult.division || 'N/A'}`, 250, y);
                    doc.moveDown();
                    doc.fontSize(10).text(`Remarks: ${latestResult.remarks || 'No remarks'}`, { align: 'center' });
                } else {
                    doc.fontSize(10).fillColor('#999')
                       .text('No results available for this student.', { align: 'center' });
                }
                
                doc.fontSize(8).fillColor('#999')
                   .text(`Generated on ${new Date().toLocaleDateString()} - Katwe Secondary School`, 
                         50, doc.page.height - 50, { align: 'center' });
                doc.end();
            }
        );
    });
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
    console.log(`✅ Database: SQLite (katwe_school.db)`);
    console.log(`✅ Demo: admin/admin123 | user/user123`);
});