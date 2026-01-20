require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const ADMIN_EMAIL = 'admin@gk.com';
const ADMIN_PASSWORD = 'GodlyKids2024!';

const resetOrCreateAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');

        // Find admin user by username or email
        let admin = await User.findOne({ $or: [{ username: 'admin' }, { email: ADMIN_EMAIL }] });
        
        if (admin) {
            // Update existing admin
            admin.email = ADMIN_EMAIL;
            admin.password = ADMIN_PASSWORD;
            await admin.save();
            console.log('✅ Admin user updated!');
        } else {
            // Create new admin
            admin = new User({
                username: 'admin',
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                isPremium: true,
            });
            await admin.save();
            console.log('✅ Admin user created!');
        }
        
        console.log('');
        console.log('📧 Email: admin@gk.com');
        console.log('🔑 Password: GodlyKids2024!');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

resetOrCreateAdmin();
