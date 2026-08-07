/**
 * Migration Script: Legacy Users → New Backend (AppUser)
 * 
 * This script migrates users with active subscriptions from the legacy
 * Godly Kids backend to the new backend format (AppUser collection).
 * 
 * It preserves the original _id so RevenueCat webhooks can still find them.
 * 
 * Usage:
 *   LEGACY_MONGO_URI=... MONGO_URI=... node migrate-legacy-users.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Preview what would be migrated without making changes
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Legacy DB (where Android users currently live)
const LEGACY_MONGO_URI = process.env.LEGACY_MONGO_URI;

// New DB (where new backend stores AppUsers)
const NEW_MONGO_URI = process.env.MONGO_URI;

const missing = [
  !LEGACY_MONGO_URI && 'LEGACY_MONGO_URI',
  !NEW_MONGO_URI && 'MONGO_URI',
].filter(Boolean);

if (missing.length) {
  console.error(`❌ Missing required env var(s): ${missing.join(', ')}. Export them or add them to backend/.env.`);
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

// Legacy User Schema (simplified for migration)
const legacyUserSchema = new mongoose.Schema({
  username: String,
  email: String,
  deviceId: String,
  appleId: String,
  googleId: String,
  membership: String,
  membershipPlan: String,
  subscriptionExpiryDate: Number,
  subscriptionStartDate: Number,
  isTrialUsed: Boolean,
  isTrialActive: Boolean,
  firstName: String,
  lastName: String,
  devices: [{
    deviceId: String,
    pushToken: String,
    platform: String,
    lastActive: Date,
    isActive: Boolean,
  }],
}, { timestamps: true });

// Legacy Subscription Schema
const legacySubscriptionSchema = new mongoose.Schema({
  subscriptionId: String,
  storeSubscriptionIdentifier: String,
  store: String,
  userId: mongoose.Schema.Types.ObjectId,
  status: String,
  startDate: Number,
  expiryDate: Number,
  environment: String,
  isTrial: Boolean,
}, { timestamps: true });

// New AppUser Schema (matching the new backend)
const appUserSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId, // Preserve original ID
  deviceId: String,
  email: String,
  subscriptionStatus: {
    type: String,
    enum: ['free', 'trial', 'active', 'cancelled', 'expired', 'reverse_trial'],
    default: 'free',
  },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  subscriptionPlan: {
    type: String,
    enum: ['monthly', 'annual', 'lifetime', null],
  },
  parentName: String,
  kidProfiles: [{
    name: String,
    age: Number,
  }],
  coins: { type: Number, default: 500 },
  platform: String,
  legacyUserId: String, // Reference to legacy system
  migratedAt: Date,
  migratedFrom: { type: String, default: 'legacy' },
}, { timestamps: true });

// Detect platform from subscription store or device info
function detectPlatform(subscription, device) {
  if (subscription?.store) {
    const store = subscription.store.toLowerCase();
    if (store.includes('app_store') || store.includes('apple') || store === 'app_store') {
      return 'ios';
    }
    if (store.includes('play_store') || store.includes('google') || store === 'play_store') {
      return 'android';
    }
  }
  if (device?.platform) {
    return device.platform.toLowerCase();
  }
  return 'unknown';
}

async function migrate() {
  console.log('🚀 Starting Legacy User Migration');
  console.log(isDryRun ? '📋 DRY RUN MODE - No changes will be made\n' : '\n');

  // Connect to MongoDB (assuming same cluster, different collections)
  const connection = await mongoose.connect(LEGACY_MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  // Get models
  const LegacyUser = connection.model('User', legacyUserSchema, 'users');
  const LegacySubscription = connection.model('Subscription', legacySubscriptionSchema, 'subscriptions');
  const AppUser = connection.model('AppUser', appUserSchema, 'appusers');

  // Find all active subscriptions (not expired)
  const now = Date.now();
  const activeSubscriptions = await LegacySubscription.find({
    status: 'ACTIVE',
    expiryDate: { $gt: now },
    environment: 'production',
  }).lean();

  console.log(`📊 Found ${activeSubscriptions.length} active subscriptions\n`);

  // Get unique user IDs
  const userIds = [...new Set(activeSubscriptions.map(s => s.userId.toString()))];
  console.log(`👥 ${userIds.length} unique users with active subscriptions\n`);

  // Fetch those users
  const legacyUsers = await LegacyUser.find({
    _id: { $in: userIds }
  }).lean();

  console.log(`📥 Retrieved ${legacyUsers.length} user records\n`);

  // Check which users already exist in AppUser
  const existingAppUsers = await AppUser.find({
    $or: [
      { _id: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } },
      { email: { $in: legacyUsers.map(u => u.email).filter(Boolean) } },
      { legacyUserId: { $in: userIds } },
    ]
  }).lean();

  const existingIds = new Set(existingAppUsers.map(u => u._id.toString()));
  const existingEmails = new Set(existingAppUsers.map(u => u.email?.toLowerCase()).filter(Boolean));
  const existingLegacyIds = new Set(existingAppUsers.map(u => u.legacyUserId).filter(Boolean));

  console.log(`📋 ${existingAppUsers.length} users already exist in AppUser collection\n`);

  // Migration stats
  const stats = {
    total: legacyUsers.length,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  // Migrate each user
  for (const legacyUser of legacyUsers) {
    const userId = legacyUser._id.toString();
    
    // Check if already migrated
    if (existingIds.has(userId) || existingLegacyIds.has(userId)) {
      console.log(`⏭️  Skipping ${legacyUser.email || userId} - already migrated`);
      stats.skipped++;
      continue;
    }

    // Check if email already exists
    if (legacyUser.email && existingEmails.has(legacyUser.email.toLowerCase())) {
      console.log(`⏭️  Skipping ${legacyUser.email} - email already exists in AppUser`);
      stats.skipped++;
      continue;
    }

    // Find their subscription
    const userSub = activeSubscriptions.find(s => s.userId.toString() === userId);
    
    // Determine subscription plan from product ID
    let subscriptionPlan = 'monthly';
    if (userSub?.subscriptionId) {
      if (userSub.subscriptionId.toLowerCase().includes('yearly') || 
          userSub.subscriptionId.toLowerCase().includes('annual')) {
        subscriptionPlan = 'annual';
      } else if (userSub.subscriptionId.toLowerCase().includes('lifetime')) {
        subscriptionPlan = 'lifetime';
      }
    }

    // Get primary device ID
    const primaryDevice = legacyUser.devices?.find(d => d.isActive) || legacyUser.devices?.[0];
    const deviceId = legacyUser.deviceId || primaryDevice?.deviceId;

    // Build new AppUser record
    const newAppUser = {
      _id: legacyUser._id, // CRITICAL: Preserve original ID for RevenueCat
      deviceId: deviceId,
      email: legacyUser.email?.toLowerCase(),
      subscriptionStatus: 'active',
      subscriptionStartDate: userSub?.startDate ? new Date(userSub.startDate) : null,
      subscriptionEndDate: userSub?.expiryDate ? new Date(userSub.expiryDate) : null,
      subscriptionPlan: subscriptionPlan,
      parentName: [legacyUser.firstName, legacyUser.lastName].filter(Boolean).join(' ') || '',
      kidProfiles: [],
      coins: 500,
      platform: detectPlatform(userSub, primaryDevice),
      legacyUserId: userId,
      migratedAt: new Date(),
      migratedFrom: 'legacy',
    };

    console.log(`\n👤 Migrating: ${legacyUser.email || userId}`);
    console.log(`   Plan: ${subscriptionPlan}`);
    console.log(`   Expires: ${userSub?.expiryDate ? new Date(userSub.expiryDate).toISOString() : 'unknown'}`);
    console.log(`   Device: ${deviceId || 'none'}`);

    if (!isDryRun) {
      try {
        await AppUser.create(newAppUser);
        console.log(`   ✅ Migrated successfully`);
        stats.migrated++;
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        stats.errors++;
      }
    } else {
      console.log(`   📋 Would migrate (dry run)`);
      stats.migrated++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total legacy users with active subs: ${stats.total}`);
  console.log(`Migrated: ${stats.migrated}`);
  console.log(`Skipped (already exists): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  
  if (isDryRun) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to perform actual migration.');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
