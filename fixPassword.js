const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./katwe_school.db');

// Password "teacher123" in base64 = dGVhY2hlcjEyMw==
const correctPassword = 'dGVhY2hlcjEyMw==';

db.run("UPDATE users SET password = ?, isApproved = 1 WHERE username = 'teacher'", 
    [correctPassword], 
    function(err) {
        if (err) {
            console.error('Error:', err);
        } else {
            console.log(`✅ Updated ${this.changes} user(s)`);
        }
        
        // Verify
        db.get("SELECT username, password FROM users WHERE username = 'teacher'", (err, user) => {
            if (user) {
                console.log(`\n📋 Teacher password now:`);
                console.log(`   Username: ${user.username}`);
                console.log(`   Password (base64): ${user.password}`);
                console.log(`   Password (decoded): ${Buffer.from(user.password, 'base64').toString()}`);
            }
            db.close();
        });
    }
);
