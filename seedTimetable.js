
cat > seedTimetable.js << 'EOF'
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function seedTimetable() {
    try {
        console.log('📅 Seeding timetable data...');

        // First, check if classes exist
        const classesResult = await pool.query('SELECT * FROM classes');
        
        if (classesResult.rows.length === 0) {
            console.log('No classes found. Please add classes first.');
            return;
        }

        const classId = classesResult.rows[0].id;
        const className = classesResult.rows[0].classname;
        
        console.log(`Adding timetable for ${className} (ID: ${classId})`);

        // Clear existing timetable for this class
        await pool.query('DELETE FROM timetables WHERE classId = $1', [classId]);
        console.log('Cleared existing timetable');

        // Timetable data
        const timetableData = [
            // ============ MONDAY ============
            { day: 'MONDAY', start: '08:00', end: '09:00', subject: 'MATHEMATICS', teacher: 'Mr. John', room: 'Rm 101' },
            { day: 'MONDAY', start: '09:00', end: '10:00', subject: 'ENGLISH', teacher: 'Mrs. Mary', room: 'Rm 102' },
            { day: 'MONDAY', start: '10:00', end: '11:00', subject: 'BREAK', teacher: 'BREAK', room: 'BREAK' },
            { day: 'MONDAY', start: '11:00', end: '12:00', subject: 'SCIENCE', teacher: 'Mr. Peter', room: 'Rm 103' },
            { day: 'MONDAY', start: '12:00', end: '13:00', subject: 'HISTORY', teacher: 'Mrs. Anna', room: 'Rm 104' },
            { day: 'MONDAY', start: '13:00', end: '14:00', subject: 'KISWAHILI', teacher: 'Mr. James', room: 'Rm 105' },
            { day: 'MONDAY', start: '14:00', end: '15:00', subject: 'PHYSICS', teacher: 'Mr. John', room: 'Rm 101' },
            { day: 'MONDAY', start: '15:00', end: '16:00', subject: 'CHEMISTRY', teacher: 'Mrs. Mary', room: 'Rm 102' },
            { day: 'MONDAY', start: '16:00', end: '17:00', subject: 'BIOLOGY', teacher: 'Mr. Peter', room: 'Rm 103' },

            // ============ TUESDAY ============
            { day: 'TUESDAY', start: '08:00', end: '09:00', subject: 'ENGLISH', teacher: 'Mrs. Mary', room: 'Rm 102' },
            { day: 'TUESDAY', start: '09:00', end: '10:00', subject: 'MATHEMATICS', teacher: 'Mr. John', room: 'Rm 101' },
            { day: 'TUESDAY', start: '10:00', end: '11:00', subject: 'BREAK', teacher: 'BREAK', room: 'BREAK' },
            { day: 'TUESDAY', start: '11:00', end: '12:00', subject: 'GEOGRAPHY', teacher: 'Mr. James', room: 'Rm 105' },
            { day: 'TUESDAY', start: '12:00', end: '13:00', subject: 'SCIENCE', teacher: 'Mr. Peter', room: 'Rm 103' },
            { day: 'TUESDAY', start: '13:00', end: '14:00', subject: 'HISTORY', teacher: 'Mrs. Anna', room: 'Rm 104' },
            { day: 'TUESDAY', start: '14:00', end: '15:00', subject: 'CIVICS', teacher: 'Mr. James', room: 'Rm 105' },
            { day: 'TUESDAY', start: '15:00', end: '16:00', subject: 'SPORTS', teacher: 'Mr. John', room: 'Playground' },
            { day: 'TUESDAY', start: '16:00', end: '17:00', subject: 'STUDY', teacher: 'LIBRARY', room: 'Library' },

            // ============ WEDNESDAY ============
            { day: 'WEDNESDAY', start: '08:00', end: '09:00', subject: 'SCIENCE', teacher: 'Mr. Peter', room: 'Rm 103' },
            { day: 'WEDNESDAY', start: '09:00', end: '10:00', subject: 'MATHEMATICS', teacher: 'Mr. John', room: 'Rm 101' },
            { day: 'WEDNESDAY', start: '10:00', end: '11:00', subject: 'BREAK', teacher: 'BREAK', room: 'BREAK' },
            { day: 'WEDNESDAY', start: '11:00', end: '12:00', subject: 'ENGLISH', teacher: 'Mrs. Mary', room: 'Rm 102' },
            { day: 'WEDNESDAY', start: '12:00', end: '13:00', subject: 'KISWAHILI', teacher: 'Mr. James', room: 'Rm 105' },
            { day: 'WEDNESDAY', start: '13:00', end: '14:00', subject: 'PHYSICS', teacher: 'Mr. John', room: 'Rm 101' },
            { day: 'WEDNESDAY', start: '14:00', end: '15:00', subject: 'CHEMISTRY', teacher: 'Mrs. Mary', room: 'Rm 102' },
            { day: 'WEDNESDAY', start: '15:00', end: '16:00', subject: 'BIOLOGY', teacher: 'Mr. Peter', room: 'Rm 103' },
            { day: 'WEDNESDAY', start: '16:00', end: '17:00', subject: 'COMPUTER', teacher: 'Mr. James', room: 'Lab 1' },

            // ============ THURSDAY ============
            { day: 'THURSDAY', start: '08:00', end: '09:00', subject: 'HISTORY', teacher: 'Mrs. Anna', room: 'Rm 104' },
            { day: 'THURSDAY', start: '09:00', end: '10:00', subject: 'GEOGRAPHY', teacher: 'Mr. James', room: 'Rm 105' },
            { day: 'THURSDAY', start: '10:00', end: '11:00', subject: 'BREAK', teacher: 'BREAK', room: 'BREAK' },
            { day: 'THURSDAY', start: '11:00', end: '12:00', subject: 'MATHEMATICS', teacher: 'Mr. John', room: 'Rm 101' },
            { day: 'THURSDAY', start: '12:00', end: '13:00', subject: 'ENGLISH', teacher: 'Mrs. Mary', room: 'Rm 102' },
            { day: 'THURSDAY', start: '13:00', end: '14:00', subject: 'SCIENCE', teacher: 'Mr. Peter', room: 'Rm 103' },
            { day: 'THURSDAY', start: '14:00', end: '15:00', subject: 'CIVICS', teacher: 'Mr. James', room: 'Rm 105' },
            { day: 'THURSDAY', start: '15:00', end: '16:00', subject: 'KISWAHILI', teacher: 'Mrs. Anna', room: 'Rm 104' },
            { day: 'THURSDAY', start: '16:00', end: '17:00', subject: 'STUDY', teacher: 'LIBRARY', room: 'Library' },

            // ============ FRIDAY ============
            { day: 'FRIDAY', start: '08:00', end: '09:00', subject: 'MATHEMATICS', teacher: 'Mr. John', room: 'Rm 101' },
            { day: 'FRIDAY', start: '09:00', end: '10:00', subject: 'ENGLISH', teacher: 'Mrs. Mary', room: 'Rm 102' },
            { day: 'FRIDAY', start: '10:00', end: '11:00', subject: 'BREAK', teacher: 'BREAK', room: 'BREAK' },
            { day: 'FRIDAY', start: '11:00', end: '12:00', subject: 'SCIENCE', teacher: 'Mr. Peter', room: 'Rm 103' },
            { day: 'FRIDAY', start: '12:00', end: '13:00', subject: 'PHYSICAL', teacher: 'Mr. John', room: 'Playground' },
            { day: 'FRIDAY', start: '13:00', end: '14:00', subject: 'CLUB', teacher: 'Various', room: 'Various' },
            { day: 'FRIDAY', start: '14:00', end: '15:00', subject: 'RELIGION', teacher: 'Mr. Hassan', room: 'Rm 106' },
            { day: 'FRIDAY', start: '15:00', end: '16:00', subject: 'ASSEMBLY', teacher: 'Headmaster', room: 'Hall' },
            { day: 'FRIDAY', start: '16:00', end: '17:00', subject: 'CLEANING', teacher: 'All', room: 'School' },

            // ============ SATURDAY ============
            { day: 'SATURDAY', start: '08:00', end: '09:00', subject: 'REMEDIAL', teacher: 'Various', room: 'Rm 101' },
            { day: 'SATURDAY', start: '09:00', end: '10:00', subject: 'REMEDIAL', teacher: 'Various', room: 'Rm 102' },
            { day: 'SATURDAY', start: '10:00', end: '11:00', subject: 'BREAK', teacher: 'BREAK', room: 'BREAK' },
            { day: 'SATURDAY', start: '11:00', end: '12:00', subject: 'SPORTS', teacher: 'Mr. John', room: 'Playground' },
            { day: 'SATURDAY', start: '12:00', end: '13:00', subject: 'EXTRACURRICULAR', teacher: 'Various', room: 'School' }
        ];

        // Insert each timetable entry
        for (const entry of timetableData) {
            await pool.query(
                `INSERT INTO timetables (classId, dayOfWeek, startTime, endTime, subject, teacher, room) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [classId, entry.day, entry.start, entry.end, entry.subject, entry.teacher, entry.room]
            );
        }

        console.log(`✅ Added ${timetableData.length} timetable entries for ${className}`);
        
        // Verify
        const count = await pool.query('SELECT COUNT(*) FROM timetables WHERE classId = $1', [classId]);
        console.log(`📊 Total entries in timetable: ${count.rows[0].count}`);

    } catch (error) {
        console.error('❌ Error seeding timetable:', error.message);
    } finally {
        pool.end();
    }
}

seedTimetable();
EOF