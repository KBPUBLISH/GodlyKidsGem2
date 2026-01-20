require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

// Get credentials from command line arguments or use defaults
const ADMIN_EMAIL = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@godlykids.com';
const ADMIN_PASSWORD = process.argv[3] || process.env.ADMIN_PASSWORD;
const ADMIN_USERNAME = process.argv[4] || 'admin';

const createAdmin = async () => {
    if (!ADMIN_PASSWORD) {
        console.log('❌ Error: Password is required!');
        console.log('');
        console.log('Usage: node create-admin.js <email> <password> [username]');
        console.log('');
        console.log('Examples:');
        console.log('  node create-admin.js admin@godlykids.com MySecurePass123');
        console.log('  node create-admin.js admin@gk.com MyPass123 myadmin');
        console.log('');
        console.log('Or set environment variables:');
        console.log('  ADMIN_EMAIL=admin@gk.com ADMIN_PASSWORD=MyPass123 node create-admin.js');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');

        // Check if admin already exists by email or username
        const existingByEmail = await User.findOne({ email: ADMIN_EMAIL });
        const existingByUsername = await User.findOne({ username: ADMIN_USERNAME });
        
        if (existingByEmail) {
            console.log('⚠️  User already exists with email:', ADMIN_EMAIL);
            console.log('   Use these credentials to login, or use reset-admin-password.js to change the password.');
            process.exit(0);
        }
        
        if (existingByUsername) {
            console.log('⚠️  User already exists with username:', ADMIN_USERNAME);
            console.log('   Email:', existingByUsername.email);
            console.log('   Try logging in with this email.');
            process.exit(0);
        }

        // Create admin user
        const admin = new User({
            username: ADMIN_USERNAME,
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            isPremium: true,
        });

        await admin.save();
        console.log('✅ Admin user created successfully!');
        console.log('');
        console.log('📧 Email:', ADMIN_EMAIL);
        console.log('👤 Username:', ADMIN_USERNAME);
        console.log('');
        console.log('⚠️  Please keep your password secure!');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

createAdmin();
