/**
 * One-off script: Check whether a user is marked premium in the backend.
 * Read-only — it does NOT change anything. Use it to diagnose "I paid but
 * have no access" reports before deciding whether to run grant-lifetime-by-email.js.
 *
 * It looks the email (and any linked deviceId) up in BOTH collections, since
 * premium can live in either:
 *   - User.isPremium
 *   - AppUser.subscriptionStatus === 'active'
 *
 * Usage:
 *   node check-premium-by-email.js <email>
 *   node check-premium-by-email.js deanna.fillion@icloud.com
 *
 * Requires MONGO_URI in .env or environment.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const AppUser = require('./src/models/AppUser');

const email = (process.argv[2] || process.env.CHECK_EMAIL || '').toLowerCase().trim();

async function checkPremium() {
  if (!email || !email.includes('@')) {
    console.log('Usage: node check-premium-by-email.js <email>');
    console.log('Example: node check-premium-by-email.js deanna.fillion@icloud.com');
    process.exit(1);
  }

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('MONGO_URI not set. Set it in .env or environment.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Checking premium status for:', email);
  console.log('='.repeat(60));

  // --- User collection (auth accounts) ---
  const user = await User.findOne({ email });
  if (user) {
    console.log('User collection: FOUND');
    console.log('  _id:                   ', user._id.toString());
    console.log('  isPremium:             ', user.isPremium === true);
    console.log('  subscriptionProductId: ', user.subscriptionProductId || '(none)');
    console.log('  subscriptionExpiresAt: ', user.subscriptionExpiresAt || '(none — lifetime/never)');
    console.log('  deviceId:              ', user.deviceId || '(none)');
  } else {
    console.log('User collection: NOT FOUND for this email');
  }

  console.log('-'.repeat(60));

  // --- AppUser collection (app/anonymous users) ---
  // Match by email, and also by the User's deviceId if we have one.
  const appUserQuery = { $or: [{ email }] };
  if (user?.deviceId) appUserQuery.$or.push({ deviceId: user.deviceId });
  const appUser = await AppUser.findOne(appUserQuery);
  if (appUser) {
    console.log('AppUser collection: FOUND');
    console.log('  _id:                ', appUser._id.toString());
    console.log('  email:              ', appUser.email || '(none)');
    console.log('  deviceId:           ', appUser.deviceId || '(none)');
    console.log('  subscriptionStatus: ', appUser.subscriptionStatus);
    console.log('  subscriptionPlan:   ', appUser.subscriptionPlan || '(none)');
    console.log('  subscriptionStart:  ', appUser.subscriptionStartDate || '(none)');
    console.log('  subscriptionEnd:    ', appUser.subscriptionEndDate || '(none — lifetime/never)');
  } else {
    console.log('AppUser collection: NOT FOUND for this email/deviceId');
  }

  console.log('='.repeat(60));

  // --- Verdict: matches the backend's own premium gating logic ---
  const userPremium = user?.isPremium === true;
  const appUserPremium = appUser?.subscriptionStatus === 'active';
  const hasPremium = userPremium || appUserPremium;

  console.log('VERDICT:', hasPremium ? 'PREMIUM (has access)' : 'NOT PREMIUM (no access)');
  if (!hasPremium) {
    console.log('Source breakdown -> User.isPremium:', userPremium, '| AppUser.active:', appUserPremium);
    console.log('To grant: node grant-lifetime-by-email.js', email);
  } else {
    console.log('Source -> ' + (userPremium ? 'User.isPremium ' : '') + (appUserPremium ? 'AppUser.active' : ''));
  }

  await mongoose.disconnect();
  process.exit(0);
}

checkPremium().catch((err) => {
  console.error(err);
  process.exit(1);
});
