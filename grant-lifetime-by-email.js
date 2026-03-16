/**
 * One-off script: Grant lifetime premium to a user by email.
 * Use when someone purchased lifetime (e.g. via App Store) but the RevenueCat
 * webhook didn't sync (e.g. they weren't signed in with that email at purchase,
 * or webhook was misconfigured).
 *
 * Usage:
 *   node grant-lifetime-by-email.js <email>
 *   node grant-lifetime-by-email.js ashleykstaton@yahoo.com
 *
 * Requires MONGO_URI in .env or environment.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const AppUser = require('./src/models/AppUser');

const email = (process.argv[2] || process.env.GRANT_EMAIL || '').toLowerCase().trim();

async function grantLifetime() {
  if (!email || !email.includes('@')) {
    console.log('Usage: node grant-lifetime-by-email.js <email>');
    console.log('Example: node grant-lifetime-by-email.js ashleykstaton@yahoo.com');
    process.exit(1);
  }

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('MONGO_URI not set. Set it in .env or environment.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Granting lifetime premium to:', email);

  const user = await User.findOne({ email });
  const appUser = await AppUser.findOne({ $or: [{ email }, { email: email.toLowerCase() }] });

  if (!user && !appUser) {
    console.log('No User or AppUser found for this email. User may need to sign up first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  if (user) {
    user.isPremium = true;
    user.subscriptionProductId = 'lifetime';
    user.subscriptionExpiresAt = undefined; // lifetime has no expiry
    await user.save();
    console.log('Updated User (isPremium=true, subscriptionPlan=lifetime)');
  }

  if (appUser) {
    appUser.subscriptionStatus = 'active';
    appUser.subscriptionPlan = 'lifetime';
    appUser.subscriptionEndDate = undefined;
    appUser.subscriptionStartDate = appUser.subscriptionStartDate || new Date();
    await appUser.save();
    console.log('Updated AppUser (subscriptionStatus=active, subscriptionPlan=lifetime)');
  } else if (user) {
    const newAppUser = new AppUser({
      email: user.email,
      subscriptionStatus: 'active',
      subscriptionPlan: 'lifetime',
      subscriptionStartDate: new Date(),
      onboardingStatus: 'not_started',
      kidProfiles: [],
      coins: 500,
    });
    await newAppUser.save();
    console.log('Created AppUser with lifetime so purchase-status lookup works.');
  }

  console.log('Done. Have the user open the app, go to Settings, and tap "Restore Purchases" to refresh premium.');
  await mongoose.disconnect();
  process.exit(0);
}

grantLifetime().catch((err) => {
  console.error(err);
  process.exit(1);
});
