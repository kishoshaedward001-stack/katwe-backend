const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Email configuration (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Barua pepe yako
        pass: process.env.EMAIL_PASS  // App password (sio password ya kawaida)
    }
});

// ============ SEND EMAIL ENDPOINT ============
app.post('/api/send-results', async (req, res) => {
    const { student, results } = req.body;
    
    // Build email content
    const emailContent = `
        <h2>Katwe Secondary School - Matokeo ya Mitihani</h2>
        <p><strong>Jina:</strong> ${student.fullName}</p>
        <p><strong>Kozi:</strong> ${student.course}</p>
        <hr/>
        <h3>Matokeo:</h3>
        <ul>
            <li>${results.subject1}: ${results.grade1}</li>
            <li>${results.subject2}: ${results.grade2}</li>
            <li>${results.subject3}: ${results.grade3}</li>
            <li>${results.subject4}: ${results.grade4}</li>
        </ul>
        <p><strong>Maoni:</strong> ${results.remarks}</p>
        <hr/>
        <p>Asante,<br/>Katwe Secondary School</p>
    `;
    
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: student.email,
            subject: `Matokeo yako - ${student.fullName}`,
            html: emailContent
        });
        
        res.json({ success: true, message: 'Email imetumwa!' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ API ENDPOINTS (CRUD) ============
// GET all students
app.get('/api/students', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM students ORDER BY "createdAt" DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new student
app.post('/api/students', async (req, res) => {
    const { fullName, age, gender, course, phone, email } = req.body;
    
    try {
        const result = await pool.query(
            'INSERT INTO students ("fullName", age, gender, course, phone, email) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [fullName, age, gender, course, phone || null, email || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update student
app.put('/api/students/:id', async (req, res) => {
    const { fullName, age, gender, course, phone, email } = req.body;
    try {
        const result = await pool.query(
            'UPDATE students SET "fullName" = $1, age = $2, gender = $3, course = $4, phone = $5, email = $6 WHERE id = $7 RETURNING *',
            [fullName, age, gender, course, phone, email, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE student
app.delete('/api/students/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});