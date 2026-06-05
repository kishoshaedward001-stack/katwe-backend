const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Kwanza unganisha bila database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: ''
});

// Unda database na tables
db.connect((err) => {
    if (err) {
        console.error('Connection error:', err);
        return;
    }
    console.log('Connected to MySQL server');
    
    // Unda database
    db.query('CREATE DATABASE IF NOT EXISTS katwe_school_db', (err) => {
        if (err) {
            console.error('Error creating database:', err);
            return;
        }
        console.log('✅ Database ensured');
        
        // Sasa unganisha kwenye database
        const dbWithDB = mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'katwe_school_db'
        });
        
        dbWithDB.connect((err) => {
            if (err) {
                console.error('Error connecting to database:', err);
                return;
            }
            console.log('✅ Connected to katwe_school_db');
            
            // Unda table
            const createTable = `
            CREATE TABLE IF NOT EXISTS students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fullName VARCHAR(255) NOT NULL,
                age INT NOT NULL,
                gender ENUM('MALE', 'FEMALE') NOT NULL,
                course VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`;
            
            dbWithDB.query(createTable, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                } else {
                    console.log('✅ Students table ready');
                    
                    // Ingiza sample data ikiwa table ni tupu
                    dbWithDB.query('SELECT COUNT(*) as count FROM students', (err, result) => {
                        if (err) return;
                        if (result[0].count === 0) {
                            const sampleData = `
                            INSERT INTO students (fullName, age, gender, course, phone) VALUES
                            ('Mariamu Ramadhani', 23, 'FEMALE', 'information technology', '0712345678'),
                            ('Martha Juma', 22, 'FEMALE', 'chemistry', '7474785785'),
                            ('zabron elikana', 23, 'MALE', 'science', ''),
                            ('John Doe', 22, 'MALE', 'BSc. Computer Science', '0712345679')`;
                            
                            dbWithDB.query(sampleData, (err) => {
                                if (err) console.error('Error inserting sample data:', err);
                                else console.log('✅ Sample data inserted');
                            });
                        }
                    });
                }
            });
            
            // API endpoints (tumia dbWithDB)
            app.get('/api/students', (req, res) => {
                dbWithDB.query('SELECT * FROM students ORDER BY createdAt DESC', (err, results) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json(results);
                });
            });
            
            app.post('/api/students', (req, res) => {
                const { fullName, age, gender, course, phone } = req.body;
                if (!fullName || !age || !gender || !course) {
                    return res.status(400).json({ message: 'Missing required fields' });
                }
                const sql = 'INSERT INTO students (fullName, age, gender, course, phone) VALUES (?, ?, ?, ?, ?)';
                dbWithDB.query(sql, [fullName, age, gender, course, phone || null], (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.status(201).json({ id: result.insertId, fullName, age, gender, course, phone });
                });
            });
            
            app.put('/api/students/:id', (req, res) => {
                const { fullName, age, gender, course, phone } = req.body;
                const sql = 'UPDATE students SET fullName = ?, age = ?, gender = ?, course = ?, phone = ? WHERE id = ?';
                dbWithDB.query(sql, [fullName, age, gender, course, phone, req.params.id], (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (result.affectedRows === 0) return res.status(404).json({ message: 'Student not found' });
                    res.json({ message: 'Student updated successfully' });
                });
            });
            
            app.delete('/api/students/:id', (req, res) => {
                dbWithDB.query('DELETE FROM students WHERE id = ?', [req.params.id], (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (result.affectedRows === 0) return res.status(404).json({ message: 'Student not found' });
                    res.json({ message: 'Student deleted successfully' });
                });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});