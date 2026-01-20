require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

// Get credentials from command line arguments or environment variables
const ADMIN_EMAIL = process.argv[2] || process.env.ADMIN_EMAIL;
const NEW_PASSWORD = process.argv[3] || process.env.ADMIN_PASSWORD;

const resetOrCreateAdmin = async () => {
    if (!ADMIN_EMAIL || !NEW_PASSWORD) {
        console.log('❌ Error: Email and password are required!');
        console.log('');
        console.log('Usage: node reset-admin-password.js <email> <new_password>');
        console.log('');
        console.log('Examples:');
        console.log('  node reset-admin-password.js admin@godlykids.com NewSecurePass123');
        console.log('  node reset-admin-password.js admin@gk.com MyNewPass456');
        console.log('');
        console.log('Or set environment variables:');
        console.log('  ADMIN_EMAIL=admin@gk.com ADMIN_PASSWORD=NewPass123 node reset-admin-password.js');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');

        // Find admin user by email
        let admin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase().trim() });
        
        if (admin) {
            // Update existing admin password
            admin.password = NEW_PASSWORD;
            await admin.save();
            console.log('✅ Password updated for:', ADMIN_EMAIL);
        } else {
            // Create new admin if not found
            admin = new User({
                username: ADMIN_EMAIL.split('@')[0],
                email: ADMIN_EMAIL.toLowerCase().trim(),
                password: NEW_PASSWORD,
                isPremium: true,
            });
            await admin.save();
            console.log('✅ Admin user created:', ADMIN_EMAIL);
        }
        
        console.log('');
        console.log('📧 Email:', ADMIN_EMAIL);
        console.log('✅ Password has been set');
        console.log('');
        console.log('You can now login to the portal with these credentials.');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

resetOrCreateAdmin();
