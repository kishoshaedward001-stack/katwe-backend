const express = require('express');
const cors = require('cors');
const compression = require('compression');
const PDFDocument = require('pdfkit');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============ IN-MEMORY DATABASE ============
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

// ============ HELPER FUNCTIONS FOR GRADES ============

// Convert score to letter grade
const getLetterGrade = (score) => {
    if (score >= 75) return 'A';
    if (score >= 65) return 'B';
    if (score >= 45) return 'C';
    if (score >= 30) return 'D';
    return 'F';
};

// Convert letter grade to points for division
const getGradePoints = (grade) => {
    const points = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5 };
    return points[grade] || 5;
};

// Calculate average from scores
const calculateAverage = (scores) => {
    let total = 0;
    let count = 0;
    const scoreList = [scores.score1, scores.score2, scores.score3, scores.score4, scores.score5, scores.score6, scores.score7];
    scoreList.forEach(score => {
        if (score && score !== '' && !isNaN(score)) {
            total += parseFloat(score);
            count++;
        }
    });
    return count > 0 ? (total / count) : 0;
};

// Calculate division based on points (A=1, B=2, C=3, D=4, F=5)
// Division = (sum of points) / (number of subjects)
const calculateDivision = (grades) => {
    let totalPoints = 0;
    let count = 0;
    const gradeList = [grades.grade1, grades.grade2, grades.grade3, grades.grade4, grades.grade5, grades.grade6, grades.grade7];
    gradeList.forEach(grade => {
        if (grade && grade !== '') {
            totalPoints += getGradePoints(grade);
            count++;
        }
    });
    
    const avgPoints = count > 0 ? totalPoints / count : 5;
    
    if (avgPoints <= 1.5) return 'I';
    if (avgPoints <= 2.5) return 'II';
    if (avgPoints <= 3.5) return 'III';
    if (avgPoints <= 4.5) return 'IV';
    return '0';
};

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ STUDENTS ============
app.get('/api/students', (req, res) => {
    res.json(data.students);
});

app.post('/api/students', (req, res) => {
    const newStudent = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
    data.students.push(newStudent);
    res.status(201).json(newStudent);
});

app.put('/api/students/:id', (req, res) => {
    const index = data.students.findIndex(s => s.id == req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });
    data.students[index] = { ...data.students[index], ...req.body };
    res.json(data.students[index]);
});

app.delete('/api/students/:id', (req, res) => {
    data.students = data.students.filter(s => s.id != req.params.id);
    res.json({ success: true });
});

// ============ AUTH ============
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = Buffer.from(password).toString('base64');
    const user = data.users.find(u => u.username === username && u.password === hashedPassword);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, isApproved: user.isApproved } });
});

app.post('/api/auth/register', (req, res) => {
    const { username, email, password, fullName, phone } = req.body;
    if (data.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username exists' });
    }
    data.users.push({
        id: Date.now(), username, email,
        password: Buffer.from(password).toString('base64'),
        fullName: fullName || '', phone: phone || '',
        role: 'user', isApproved: false
    });
    res.json({ success: true, message: 'Registered! Wait for approval.' });
});

app.get('/api/users', (req, res) => {
    res.json(data.users.map(u => ({ id: u.id, username: u.username, email: u.email, fullName: u.fullName, phone: u.phone, role: u.role, isApproved: u.isApproved })));
});

app.put('/api/users/:id/approve', (req, res) => {
    const user = data.users.find(u => u.id == req.params.id);
    if (user) user.isApproved = true;
    res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
    data.users = data.users.filter(u => u.id != req.params.id);
    res.json({ success: true });
});

// ============ CLASSES ============
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

// ============ TIMETABLE ============
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

// ============ PARENTS ============
app.post('/api/parents/generate', (req, res) => {
    const parentCode = Math.floor(100000 + Math.random() * 900000).toString();
    data.parents.push({ id: Date.now(), parentCode, ...req.body });
    res.json({ success: true, parentCode });
});

app.post('/api/parents/login', (req, res) => {
    const parent = data.parents.find(p => p.parentCode === req.body.parentCode);
    if (!parent) return res.status(401).json({ error: 'Invalid code' });
    const student = data.students.find(s => s.id == parent.studentId);
    res.json({ success: true, parent: { ...parent, studentName: student?.fullName, studentCourse: student?.course, studentPhoto: student?.photo } });
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


// ============ RESULTS ============
app.post('/api/results', (req, res) => {
    const { 
        studentId, 
        subject1, score1, grade1,
        subject2, score2, grade2,
        subject3, score3, grade3,
        subject4, score4, grade4,
        subject5, score5, grade5,
        subject6, score6, grade6,
        subject7, score7, grade7,
        remarks, term, year 
    } = req.body;
    
    // Calculate letter grades from scores
    const finalGrade1 = grade1 || (score1 ? getLetterGrade(parseFloat(score1)) : '');
    const finalGrade2 = grade2 || (score2 ? getLetterGrade(parseFloat(score2)) : '');
    const finalGrade3 = grade3 || (score3 ? getLetterGrade(parseFloat(score3)) : '');
    const finalGrade4 = grade4 || (score4 ? getLetterGrade(parseFloat(score4)) : '');
    const finalGrade5 = grade5 || (score5 ? getLetterGrade(parseFloat(score5)) : '');
    const finalGrade6 = grade6 || (score6 ? getLetterGrade(parseFloat(score6)) : '');
    const finalGrade7 = grade7 || (score7 ? getLetterGrade(parseFloat(score7)) : '');
    
    // Calculate average from scores
    const scores = { score1, score2, score3, score4, score5, score6, score7 };
    const average = calculateAverage(scores);
    
    // Calculate division
    const grades = { grade1: finalGrade1, grade2: finalGrade2, grade3: finalGrade3, grade4: finalGrade4, grade5: finalGrade5, grade6: finalGrade6, grade7: finalGrade7 };
    const division = calculateDivision(grades);
    
    const newResult = {
        id: Date.now(),
        studentId,
        subject1, score1, grade1: finalGrade1,
        subject2, score2, grade2: finalGrade2,
        subject3, score3, grade3: finalGrade3,
        subject4, score4, grade4: finalGrade4,
        subject5, score5, grade5: finalGrade5,
        subject6, score6, grade6: finalGrade6,
        subject7, score7, grade7: finalGrade7,
        remarks,
        term: term || 'Term 1',
        year: year || new Date().getFullYear(),
        average: parseFloat(average.toFixed(2)),
        division,
        createdAt: new Date().toISOString()
    };
    
    data.results.push(newResult);
    res.json({ success: true, average: average.toFixed(2), division });
});
// ============ ANNOUNCEMENTS ============
app.get('/api/announcements', (req, res) => {
    res.json(data.announcements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/announcements', (req, res) => {
    const newAnn = { id: Date.now(), ...req.body, createdAt: new Date().toISOString() };
    data.announcements.unshift(newAnn);
    res.status(201).json(newAnn);
});

app.delete('/api/announcements/:id', (req, res) => {
    data.announcements = data.announcements.filter(a => a.id != req.params.id);
    res.json({ success: true });
});

// ============ MOCK UPLOADS ============
app.post('/api/upload-photo', (req, res) => {
    res.json({ success: true, imageUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' });
});

app.post('/api/upload-announcement-image', (req, res) => {
    res.json({ success: true, imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500' });
});

app.post('/api/send-results', (req, res) => res.json({ success: true }));
app.post('/api/send-sms', (req, res) => res.json({ success: true }));

// ============ PDF REPORTS ============

// Generate PDF for a single student
app.get('/api/report/student/:id', (req, res) => {
    const student = data.students.find(s => s.id == req.params.id);
    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }
    
    const studentResults = data.results.filter(r => r.studentId == student.id);
    const latestResult = studentResults[0] || null;
    
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report_${student.fullName.replace(/\s/g, '_')}.pdf`);
    
    doc.pipe(res);
    
    // Header
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e3c72').text('KATWE SECONDARY SCHOOL', { align: 'center' });
    doc.fontSize(14).fillColor('#666').text('Student Academic Report', { align: 'center' });
    doc.moveDown();
    
    // Student Info
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#333').text('STUDENT INFORMATION', { underline: true });
    doc.fontSize(10).font('Helvetica').fillColor('#555')
       .text(`Name: ${student.fullName}`)
       .text(`Age: ${student.age} years`)
       .text(`Gender: ${student.gender === 'MALE' ? 'Male' : 'Female'}`)
       .text(`Course: ${student.course}`)
       .text(`Phone: ${student.phone || 'N/A'}`)
       .text(`Email: ${student.email || 'N/A'}`);
    doc.moveDown();
    
    // Results
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#333').text('ACADEMIC RESULTS', { underline: true });
    
    if (latestResult) {
        const grades = [
            { subject: latestResult.subject1 || 'N/A', grade: latestResult.grade1 || 'N/A' },
            { subject: latestResult.subject2 || 'N/A', grade: latestResult.grade2 || 'N/A' },
            { subject: latestResult.subject3 || 'N/A', grade: latestResult.grade3 || 'N/A' },
            { subject: latestResult.subject4 || 'N/A', grade: latestResult.grade4 || 'N/A' }
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
        doc.fontSize(10).text(`Average: ${latestResult.average || 'N/A'}`, 50, y)
           .text(`Division: ${latestResult.division || 'N/A'}`, 250, y);
        doc.moveDown();
        doc.fontSize(10).text(`Remarks: ${latestResult.remarks || 'No remarks'}`, { align: 'center' });
    } else {
        doc.fontSize(10).fillColor('#999').text('No results available for this student.', { align: 'center' });
    }
    
    doc.fontSize(8).fillColor('#999')
       .text(`Generated on ${new Date().toLocaleDateString()} - Katwe Secondary School`, 50, doc.page.height - 50, { align: 'center' });
    
    doc.end();
});

// Generate PDF for all students
app.get('/api/report/all-students', (req, res) => {
    const doc = new PDFDocument({ margin: 50, layout: 'landscape' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=all_students_report.pdf');
    
    doc.pipe(res);
    
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e3c72').text('KATWE SECONDARY SCHOOL', { align: 'center' });
    doc.fontSize(14).fillColor('#666').text('All Students Report', { align: 'center' });
    doc.moveDown();
    
    let y = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('white').rect(50, y, 500, 20).fill('#1e3c72');
    doc.fillColor('white').text('Name', 55, y + 5).text('Age', 155, y + 5).text('Gender', 205, y + 5).text('Course', 275, y + 5).text('Phone', 375, y + 5).text('Email', 455, y + 5);
    y += 25;
    
    data.students.forEach((student, index) => {
        if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
        const bgColor = index % 2 === 0 ? '#f5f5f5' : 'white';
        doc.rect(50, y - 3, 500, 22).fill(bgColor);
        doc.fillColor('#333').fontSize(8)
           .text(student.fullName.substring(0, 30), 55, y)
           .text(student.age.toString(), 155, y)
           .text(student.gender === 'MALE' ? 'M' : 'F', 205, y)
           .text(student.course.substring(0, 25), 275, y)
           .text(student.phone || '-', 375, y)
           .text((student.email || '-').substring(0, 25), 455, y);
        y += 25;
    });
    
    doc.end();
});

// Generate class report
app.get('/api/report/class/:className', (req, res) => {
    const { className } = req.params;
    const classStudents = data.students.filter(s => s.course === className);
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${className}_report.pdf`);
    
    doc.pipe(res);
    
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e3c72').text('KATWE SECONDARY SCHOOL', { align: 'center' });
    doc.fontSize(14).fillColor('#666').text(`${className} - Class Report`, { align: 'center' });
    doc.moveDown();
    
    const maleCount = classStudents.filter(s => s.gender === 'MALE').length;
    const femaleCount = classStudents.filter(s => s.gender === 'FEMALE').length;
    
    doc.fontSize(10).fillColor('#333')
       .text(`Total Students: ${classStudents.length}`)
       .text(`Male: ${maleCount}`)
       .text(`Female: ${femaleCount}`);
    doc.moveDown();
    
    doc.fontSize(12).font('Helvetica-Bold').text('STUDENT LIST', { underline: true });
    doc.moveDown(0.5);
    
    let y = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('white').rect(50, y, 450, 20).fill('#1e3c72');
    doc.fillColor('white').text('#', 55, y + 5).text('Name', 75, y + 5).text('Age', 225, y + 5).text('Gender', 275, y + 5).text('Phone', 325, y + 5);
    y += 25;
    
    classStudents.forEach((student, index) => {
        if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
        const bgColor = index % 2 === 0 ? '#f5f5f5' : 'white';
        doc.rect(50, y - 3, 450, 22).fill(bgColor);
        doc.fillColor('#333').fontSize(8)
           .text((index + 1).toString(), 55, y)
           .text(student.fullName.substring(0, 30), 75, y)
           .text(student.age.toString(), 225, y)
           .text(student.gender === 'MALE' ? 'M' : 'F', 275, y)
           .text(student.phone || '-', 325, y);
        y += 25;
    });
    
    doc.end();
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ In-memory database mode`);
    console.log(`✅ Admin: admin / admin123`);
    console.log(`✅ Teacher: teacher / teacher123`);
    console.log(`✅ PDF Reports: /api/report/student/:id`);
});