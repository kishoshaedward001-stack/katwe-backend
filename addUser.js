const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./katwe_school.db');

db.serialize(() => {
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        if (row.count === 0) {
            console.log('📚 Adding default users...');
            
            db.run(`INSERT INTO users (username, email, password, fullName, role, isApproved) 
                    VALUES (?, ?, ?, ?, ?, ?)`, 
                    ['admin', 'admin@katwe.edu', 'YWRtaW4xMjM=', 'Admin Mkuu', 'admin', 1]);
            
            db.run(`INSERT INTO users (username, email, password, fullName, role, isApproved) 
                    VALUES (?, ?, ?, ?, ?, ?)`, 
                    ['teacher', 'teacher@katwe.edu', 'dGVhY2hlcjEyMw==', 'Mwalimu Juma', 'user', 1]);
            
            console.log('✅ Default users added successfully!');
        } else {
            console.log(`📊 Users already exist: ${row.count} users found`);
        }
        
        db.all("SELECT id, username, fullName, role, isApproved FROM users", (err, users) => {
            if (err) return;
            console.log('\n📋 Users in database:');
            users.forEach(u => {
                console.log(`   - ${u.username} (${u.fullName}) - ${u.role} - Approved: ${u.isApproved ? 'Yes' : 'No'}`);
            });
        });
    });
});

db.close();
