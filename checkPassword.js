const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./katwe_school.db');

db.all("SELECT username, password, isApproved FROM users", (err, users) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    
    console.log('📋 Users and passwords:');
    users.forEach(u => {
        console.log(`   Username: ${u.username}`);
        console.log(`   Password (base64): ${u.password}`);
        console.log(`   Password (decoded): ${Buffer.from(u.password, 'base64').toString()}`);
        console.log(`   Approved: ${u.isApproved ? 'Yes' : 'No'}`);
        console.log('   ---');
    });
    
    db.close();
});
