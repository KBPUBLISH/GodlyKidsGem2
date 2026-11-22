/**
 * Sync Script: User.isPremium → AppUser.subscriptionStatus
 * 
 * This script syncs premium status between the users and appusers collections.
 * It ensures that if a user has isPremium: true, their AppUser record
 * also shows subscriptionStatus: 'active'.
 * 
 * Usage:
 *   MONGO_URI=... node sync-premium-status.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview what would be synced without making changes
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not set. Export it or add it to backend/.env before running this script.');
  process.exit(1);
}

// The URI must name the target database explicitly; a bare cluster URI would sync the wrong one.
if (!/mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/.test(MONGO_URI)) {
  console.error('❌ MONGO_URI must include a database name (e.g. .../Production?retryWrites=true).');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

async function sync() {
  console.log('🔄 Starting Premium Status Sync');
  console.log(isDryRun ? '📋 DRY RUN MODE - No changes will be made\n' : '\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  const appUsersCollection = db.collection('appusers');

  // Stats
  const stats = {
    premiumUsers: 0,
    alreadySynced: 0,
    updated: 0,
    created: 0,
    errors: 0,
  };

  // Find all premium users
  const premiumUsers = await usersCollection.find({ isPremium: true }).toArray();
  stats.premiumUsers = premiumUsers.length;
  
  console.log(`👑 Found ${premiumUsers.length} premium users in 'users' collection\n`);

  for (const user of premiumUsers) {
    console.log(`\n--- Processing: ${user.email || user._id} ---`);
    
    // Find matching AppUser by email (case-insensitive) or by _id
    let appUser = await appUsersCollection.findOne({
      $or: [
        { email: user.email?.toLowerCase() },
        { email: user.email },
        { _id: user._id },
      ]
    });

    if (appUser) {
      // AppUser exists - check if needs update
      if (appUser.subscriptionStatus === 'active') {
        console.log('  ✅ Already synced (status: active)');
        stats.alreadySynced++;
      } else {
        console.log(`  ⚠️  Status mismatch: User.isPremium=true, AppUser.status=${appUser.subscriptionStatus}`);
        
        if (!isDryRun) {
          try {
            await appUsersCollection.updateOne(
              { _id: appUser._id },
              {
                $set: {
                  subscriptionStatus: 'active',
                  subscriptionPlan: user.subscriptionExpiryDate ? 
                    (user.subscriptionExpiryDate > Date.now() + 180 * 24 * 60 * 60 * 1000 ? 'annual' : 'monthly') : 
                    'monthly',
                  subscriptionEndDate: user.subscriptionExpiryDate ? new Date(user.subscriptionExpiryDate) : null,
                  syncedFromUser: true,
                  syncedAt: new Date(),
                }
              }
            );
            console.log('  ✅ Updated AppUser to active');
            stats.updated++;
          } catch (error) {
            console.log('  ❌ Error:', error.message);
            stats.errors++;
          }
        } else {
          console.log('  📋 Would update to active (dry run)');
          stats.updated++;
        }
      }
    } else {
      // No AppUser exists - create one
      console.log('  ⚠️  No AppUser record found - creating one');
      
      const newAppUser = {
        _id: new mongoose.Types.ObjectId(), // New ID (not preserving user._id since they're different collections)
        email: user.email?.toLowerCase(),
        subscriptionStatus: 'active',
        subscriptionPlan: user.subscriptionExpiryDate ? 
          (user.subscriptionExpiryDate > Date.now() + 180 * 24 * 60 * 60 * 1000 ? 'annual' : 'monthly') : 
          'monthly',
        subscriptionEndDate: user.subscriptionExpiryDate ? new Date(user.subscriptionExpiryDate) : null,
        parentName: [user.firstName, user.lastName].filter(Boolean).join(' ') || '',
        kidProfiles: [],
        coins: 500,
        platform: 'unknown',
        onboardingStatus: 'not_started',
        createdFromUserSync: true,
        linkedUserId: user._id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (!isDryRun) {
        try {
          await appUsersCollection.insertOne(newAppUser);
          console.log('  ✅ Created new AppUser record');
          stats.created++;
        } catch (error) {
          console.log('  ❌ Error:', error.message);
          stats.errors++;
        }
      } else {
        console.log('  📋 Would create AppUser (dry run)');
        stats.created++;
      }
    }
  }

  // Also check for AppUsers with active status that might have expired
  console.log('\n\n🔍 Checking for expired subscriptions...');
  const now = Date.now();
  const activeAppUsers = await appUsersCollection.find({
    subscriptionStatus: 'active',
    subscriptionEndDate: { $lt: new Date(now) }
  }).toArray();

  if (activeAppUsers.length > 0) {
    console.log(`⚠️  Found ${activeAppUsers.length} AppUsers with expired subscriptions still marked active:`);
    for (const au of activeAppUsers) {
      console.log(`  - ${au.email || au.deviceId}: expired ${au.subscriptionEndDate}`);
    }
    console.log('\n(RevenueCat webhooks should handle these, but worth checking)');
  } else {
    console.log('✅ No expired subscriptions found that are still marked active');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SYNC SUMMARY');
  console.log('='.repeat(50));
  console.log(`Premium users found: ${stats.premiumUsers}`);
  console.log(`Already synced: ${stats.alreadySynced}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Created: ${stats.created}`);
  console.log(`Errors: ${stats.errors}`);
  
  if (isDryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to perform actual sync.');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

sync().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
