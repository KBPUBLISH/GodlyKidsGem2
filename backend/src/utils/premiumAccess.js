const User = require('../models/User');
const AppUser = require('../models/AppUser');

const normalizeId = (id) => {
  if (id == null || typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!trimmed || trimmed === 'anonymous') return null;
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
};

/**
 * Collect unique identifiers for granting/checking premium (metadata id + Stripe checkout email).
 */
const collectPremiumIds = (...rawIds) => {
  const seen = new Set();
  const ids = [];
  for (const raw of rawIds) {
    const id = normalizeId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
};

/**
 * Grant premium to User + AppUser for each identifier (email and/or deviceId).
 */
async function grantPremiumAccess(ids, plan) {
  const uniqueIds = collectPremiumIds(...ids);
  const results = [];

  for (const normalizedUserId of uniqueIds) {
    try {
      if (normalizedUserId.includes('@')) {
        await User.findOneAndUpdate(
          { email: normalizedUserId },
          { isPremium: true, subscriptionProductId: plan },
          { upsert: false }
        );
      }

      let appUser = await AppUser.findOne({
        $or: [
          { email: normalizedUserId },
          { deviceId: normalizedUserId },
        ],
      });

      if (appUser) {
        appUser.subscriptionStatus = 'active';
        appUser.subscriptionStartDate = appUser.subscriptionStartDate || new Date();
        appUser.subscriptionPlan = plan;
        if (normalizedUserId.includes('@')) appUser.email = normalizedUserId;
        await appUser.save();
      } else {
        appUser = await AppUser.create({
          email: normalizedUserId.includes('@') ? normalizedUserId : undefined,
          deviceId: normalizedUserId.includes('@') ? undefined : normalizedUserId,
          subscriptionStatus: 'active',
          subscriptionStartDate: new Date(),
          subscriptionPlan: plan,
        });
      }

      results.push({ id: normalizedUserId, success: true });
      console.log(`✅ Granted premium for: ${normalizedUserId}`);
    } catch (err) {
      console.error(`❌ grantPremiumAccess failed for ${normalizedUserId}:`, err);
      results.push({ id: normalizedUserId, success: false, error: err.message });
    }
  }

  return results;
}

/**
 * Check if any identifier has active premium (User.isPremium or AppUser.subscriptionStatus).
 */
async function checkPremiumAccess(ids) {
  const uniqueIds = collectPremiumIds(...ids);

  for (const externalId of uniqueIds) {
    if (externalId.includes('@')) {
      const user = await User.findOne({ email: externalId });
      if (user?.isPremium) {
        return { isPremium: true, source: 'database-user', matchedId: externalId };
      }
    } else {
      const user = await User.findOne({ deviceId: externalId });
      if (user?.isPremium) {
        return { isPremium: true, source: 'database-user', matchedId: externalId };
      }
    }

    const appUser = await AppUser.findOne({
      $or: [
        { email: externalId },
        { deviceId: externalId },
      ],
    });
    if (appUser?.subscriptionStatus === 'active') {
      return { isPremium: true, source: 'database-appuser', matchedId: externalId };
    }
  }

  return { isPremium: false, source: null, matchedId: null };
}

/**
 * Link device AppUser to email (same logic as POST /api/app-user/link-email).
 * Ensures web Stripe on device id merges into the account used on mobile sign-in.
 */
async function linkDeviceToEmail(deviceId, email) {
  if (!deviceId || !email) return { linked: false };

  const normalizedEmail = email.toLowerCase().trim();
  const existingEmailUser = await AppUser.findOne({ email: normalizedEmail });
  const deviceUser = await AppUser.findOne({ deviceId });

  if (existingEmailUser && deviceUser && existingEmailUser._id.toString() !== deviceUser._id.toString()) {
    if (deviceUser.subscriptionStatus === 'active') {
      existingEmailUser.subscriptionStatus = 'active';
      existingEmailUser.subscriptionPlan = deviceUser.subscriptionPlan || existingEmailUser.subscriptionPlan;
      existingEmailUser.subscriptionStartDate = deviceUser.subscriptionStartDate || existingEmailUser.subscriptionStartDate;
    }
    existingEmailUser.deviceId = deviceId;
    existingEmailUser.lastActiveAt = new Date();
    await existingEmailUser.save();
    await AppUser.deleteOne({ _id: deviceUser._id });
    return { linked: true, merged: true };
  }

  if (deviceUser) {
    deviceUser.email = normalizedEmail;
    deviceUser.lastActiveAt = new Date();
    await deviceUser.save();
    return { linked: true, merged: false };
  }

  return { linked: false };
}

/**
 * If AppUser has active subscription but User.isPremium is false, sync User record.
 */
async function syncUserPremiumFromAppUser(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const appUser = await AppUser.findOne({ email: normalizedEmail });
  if (appUser?.subscriptionStatus === 'active') {
    await User.findOneAndUpdate(
      { email: normalizedEmail },
      { isPremium: true },
      { upsert: false }
    );
    return true;
  }
  return false;
}

module.exports = {
  normalizeId,
  collectPremiumIds,
  grantPremiumAccess,
  checkPremiumAccess,
  linkDeviceToEmail,
  syncUserPremiumFromAppUser,
};
