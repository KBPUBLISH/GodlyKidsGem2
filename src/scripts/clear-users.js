/**
 * Clear All Users Script
 * 
 * WARNING: This script will DELETE ALL user accounts from the database!
 * This is irreversible. Only run this if you're absolutely sure.
 * 
 * Usage: node src/scripts/clear-users.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function clearAllUsers() {
    console.log('⚠️  WARNING: This will DELETE ALL user accounts!');
    console.log('⚠️  This action is IRREVERSIBLE!\n');

    try {
        // Connect to MongoDB
        if (!process.env.MONGO_URI) {
            console.error('❌ MONGO_URI not set in environment');
            process.exit(1);
        }

        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Count users before deletion
        const userCount = await User.countDocuments();
        console.log(`📊 Found ${userCount} user accounts in database\n`);

        if (userCount === 0) {
            console.log('✅ No users to delete. Database is already empty.');
            await mongoose.disconnect();
            return;
        }

        // Delete all users
        console.log('🗑️  Deleting all users...');
        const result = await User.deleteMany({});
        
        console.log(`\n✅ Successfully deleted ${result.deletedCount} user accounts`);

        // Verify deletion
        const remainingUsers = await User.countDocuments();
        console.log(`📊 Remaining users: ${remainingUsers}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
clearAllUsers();

