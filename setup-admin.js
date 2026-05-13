// setup-admin.js - Create admin user for MUT ICT
const bcrypt = require('bcrypt');
const mysql = require('mysql2');

console.log('🔧 Setting up admin user...');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mut_ict_db',
    port: 3306
});

db.connect(async (err) => {
    if (err) {
        console.error('❌ MySQL error:', err.message);
        console.log('💡 Start XAMPP MySQL first!');
        process.exit(1);
    }
    
    console.log('✅ Connected to database');
    
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);
    
    console.log('Generated hash:', hash);
    
    // Delete old admin users
    db.query('DELETE FROM users WHERE role = "admin"', (err, result) => {
        if (err) console.error('Delete error:', err);
        console.log('✅ Removed existing admin users');
        
        // Insert new admin
        db.query(
            'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
            ['admin', 'admin@mut.ac.za', hash, 'System Administrator', 'admin'],
            (err, result) => {
                if (err) {
                    console.error('Insert error:', err);
                } else {
                    console.log('\n✅ ADMIN USER CREATED SUCCESSFULLY!');
                    console.log('========================================');
                    console.log('   Email: admin@mut.ac.za');
                    console.log('   Password: admin123');
                    console.log('   Role: admin');
                    console.log('========================================\n');
                    
                    // Verify the user was created
                    db.query('SELECT id, username, email, role FROM users WHERE role = "admin"', (err, users) => {
                        if (err) console.error(err);
                        else console.log('Admin user in DB:', users[0]);
                        db.end();
                    });
                }
            }
        );
    });
});