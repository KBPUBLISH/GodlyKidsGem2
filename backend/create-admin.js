require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

// Admin credentials - CHANGE THESE!
const ADMIN_EMAIL = 'admin@godlykids.com';
const ADMIN_PASSWORD = 'GodlyKids2024!';
const ADMIN_USERNAME = 'admin';

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');

        // Check if admin already exists by email or username
        const existingByEmail = await User.findOne({ email: ADMIN_EMAIL });
        const existingByUsername = await User.findOne({ username: ADMIN_USERNAME });
        
        if (existingByEmail) {
            console.log('⚠️  User already exists with email:', ADMIN_EMAIL);
            console.log('   Use these credentials to login.');
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
        console.log('🔑 Password:', ADMIN_PASSWORD);
        console.log('');
        console.log('⚠️  Please change this password after first login!');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

createAdmin();
