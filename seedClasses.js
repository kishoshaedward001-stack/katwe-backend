
cat > seedClasses.js << 'EOF'
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function seedClasses() {
    try {
        console.log('📚 Seeding classes...');
        
        // Test connection first
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected successfully');
        
        const classes = [
            { name: 'Form 1', desc: 'Darasa la kwanza - Form One Students' },
            { name: 'Form 2', desc: 'Darasa la pili - Form Two Students' },
            { name: 'Form 3', desc: 'Darasa la tatu - Form Three Students' },
            { name: 'Form 4', desc: 'Darasa la nne - Form Four Students' }
        ];

        for (const cls of classes) {
            const existing = await pool.query('SELECT * FROM classes WHERE className = $1', [cls.name]);
            if (existing.rows.length === 0) {
                await pool.query(
                    'INSERT INTO classes (className, description) VALUES ($1, $2)',
                    [cls.name, cls.desc]
                );
                console.log(`✅ Added class: ${cls.name}`);
            } else {
                console.log(`⚠️ Class already exists: ${cls.name}`);
            }
        }
        
        const result = await pool.query('SELECT * FROM classes');
        console.log(`📊 Total classes: ${result.rows.length}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        pool.end();
    }
}

seedClasses();
EOF