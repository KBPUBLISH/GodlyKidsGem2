/**
 * Daily Engagement Notifier Job
 * 
 * Sends daily push notifications at 8am user's local time:
 * - Godly Kids Time reminders
 * - Daily verse prompts  
 * - Feature announcements
 * - Check-in messages
 * 
 * Runs every hour, finds users where it's currently 8am in their timezone
 */

const AppUser = require('../models/AppUser');
const { sendNotificationByPlayerId, sendNotificationToUser } = require('../services/notificationService');

// Notification message pool - rotates daily
const DAILY_MESSAGES = [
  // Godly Kids Time reminders
  {
    category: 'godly_time',
    title: '🌟 Good Morning!',
    message: "It's time for Godly Kids! Start your day with a story and prayer.",
    data: { type: 'daily_reminder', action: 'open_daily_session' }
  },
  {
    category: 'godly_time',
    title: '📖 Story Time Awaits!',
    message: 'A new adventure is waiting for you. Ready to learn something amazing?',
    data: { type: 'daily_reminder', action: 'open_daily_session' }
  },
  {
    category: 'godly_time',
    title: '✨ Rise and Shine!',
    message: "Let's start the day with God! Your Godly Kids Time is ready.",
    data: { type: 'daily_reminder', action: 'open_daily_session' }
  },
  {
    category: 'godly_time',
    title: '🙏 Morning Blessings!',
    message: 'Begin your day with faith. Tap to start your daily devotional!',
    data: { type: 'daily_reminder', action: 'open_daily_session' }
  },
  {
    category: 'godly_time',
    title: '🌈 A New Day, A New Story!',
    message: "God has something special for you today. Let's discover it together!",
    data: { type: 'daily_reminder', action: 'open_daily_session' }
  },
  
  // Check-in messages
  {
    category: 'checkin',
    title: '💭 Have You Spent Time With God Today?',
    message: "Take a moment to connect. Even 5 minutes makes a difference!",
    data: { type: 'daily_checkin', action: 'open_daily_session' }
  },
  {
    category: 'checkin',
    title: '❤️ Your Daily Faith Moment',
    message: "Don't forget to water your faith garden today! 🌱",
    data: { type: 'daily_checkin', action: 'open_daily_session' }
  },
  {
    category: 'checkin',
    title: '🤗 Hey There, Friend!',
    message: 'Just checking in! Have you and your little one spent time with God?',
    data: { type: 'daily_checkin', action: 'open_daily_session' }
  },
  
  // Daily verse prompts
  {
    category: 'verse',
    title: "📜 Today's Verse is Waiting!",
    message: 'Discover what scripture has in store for you today.',
    data: { type: 'daily_verse', action: 'open_daily_session' }
  },
  {
    category: 'verse',
    title: '✝️ Scripture of the Day',
    message: "God's Word has a message for your family today!",
    data: { type: 'daily_verse', action: 'open_daily_session' }
  },
  
  // Feature highlights
  {
    category: 'feature',
    title: '🎨 Did You Know?',
    message: 'Try the coloring pages after your story! Kids love them.',
    data: { type: 'feature_highlight', action: 'open_home' }
  },
  {
    category: 'feature',
    title: '🎵 Listen While You Play!',
    message: 'Check out our worship music and audio stories!',
    data: { type: 'feature_highlight', action: 'open_audio' }
  },
  {
    category: 'feature',
    title: '📚 New Stories Added!',
    message: 'Fresh content is waiting in the library. Come explore!',
    data: { type: 'feature_highlight', action: 'open_library' }
  },
  {
    category: 'feature',
    title: '🧩 Try the Quiz!',
    message: 'Test what you learned with fun quizzes after each story!',
    data: { type: 'feature_highlight', action: 'open_daily_session' }
  },
];

// Trial-specific messages (for reverse trial users)
const TRIAL_MESSAGES = {
  day2: {
    title: '🎉 How Are You Enjoying Premium?',
    message: "You've unlocked all features! Don't miss story time today.",
    data: { type: 'trial_engagement', trialDay: 2 }
  },
  day3: {
    title: '📚 Explore More Premium Stories!',
    message: 'You have access to our entire library. Try a new category today!',
    data: { type: 'trial_engagement', trialDay: 3 }
  },
  day4: {
    title: '✨ 4 Days of Growing Faith!',
    message: "You're building a great habit! Keep the streak going.",
    data: { type: 'trial_engagement', trialDay: 4 }
  },
  day5: {
    title: '⏰ 3 Days Left in Your Trial',
    message: "Don't lose your progress! Consider subscribing to keep access.",
    data: { type: 'trial_engagement', trialDay: 5 }
  },
  day6: {
    title: '⚠️ 2 Days Until Premium Ends',
    message: 'Subscribe now to keep all your bookmarks and progress!',
    data: { type: 'trial_engagement', trialDay: 6 }
  },
  day7: {
    title: '🚨 Last Day of Free Premium!',
    message: 'This is it! Subscribe today to keep your family devotional going.',
    data: { type: 'trial_engagement', trialDay: 7 }
  },
};

/**
 * Get a notification message for a user
 * Rotates through messages based on day of year to ensure variety
 */
function getDailyMessage(user, dayOfYear) {
  // Check if user is in reverse trial - send trial-specific messages
  if (user.reverseTrialActive && user.reverseTrialStartDate && !user.reverseTrialConverted) {
    const trialDay = getTrialDay(user.reverseTrialStartDate);
    const trialMessage = TRIAL_MESSAGES[`day${trialDay}`];
    if (trialMessage) {
      return trialMessage;
    }
  }
  
  // Regular daily message - rotate based on day of year and user ID hash
  const userHash = hashString(user._id.toString());
  const messageIndex = (dayOfYear + userHash) % DAILY_MESSAGES.length;
  return DAILY_MESSAGES[messageIndex];
}

/**
 * Calculate which day of the reverse trial user is on
 */
function getTrialDay(trialStartDate) {
  const now = new Date();
  const start = new Date(trialStartDate);
  const diffMs = now - start;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  return Math.min(diffDays, 7);
}

/**
 * Simple string hash for consistent randomization
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get the current hour in a given timezone
 */
function getHourInTimezone(timezone) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    });
    return parseInt(formatter.format(now), 10);
  } catch (e) {
    return null;
  }
}

/**
 * Get all valid IANA timezone identifiers where it's currently 8am
 */
function getTimezonesAt8am() {
  const targetHour = 8;
  const validTimezones = [];
  
  // Common timezone offsets to check
  // We check timezones from UTC-12 to UTC+14
  const allTimezones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [
    'Pacific/Honolulu', 'America/Los_Angeles', 'America/Denver', 'America/Chicago',
    'America/New_York', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris',
    'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai',
    'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'
  ];
  
  for (const tz of allTimezones) {
    const hour = getHourInTimezone(tz);
    if (hour === targetHour) {
      validTimezones.push(tz);
    }
  }
  
  return validTimezones;
}

/**
 * Send a daily notification to a user
 */
async function sendDailyNotification(user, message) {
  // Try OneSignal player ID first, then external user ID
  if (user.oneSignalPlayerId) {
    const result = await sendNotificationByPlayerId({
      playerId: user.oneSignalPlayerId,
      title: message.title,
      message: message.message,
      data: message.data
    });
    return { success: !!result, method: 'playerId' };
  } else {
    const result = await sendNotificationToUser({
      userId: user._id.toString(),
      title: message.title,
      message: message.message,
      data: message.data
    });
    return { success: !!result, method: 'userId' };
  }
}

/**
 * Run the daily engagement notification job
 * Should be called every hour via cron
 */
async function runDailyEngagementNotifications(options = {}) {
  const { ignoreTimezone = false } = options;
  console.log('🌅 Starting daily engagement notification job...', ignoreTimezone ? '(all users)' : '(timezone-based)');
  
  const startTime = Date.now();
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (24 * 60 * 60 * 1000));
  
  const results = {
    total: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    timezonesChecked: [],
    mode: ignoreTimezone ? 'all_users' : 'timezone_based'
  };
  
  try {
    let query;
    
    if (ignoreTimezone) {
      // Send to ALL users who have notifications enabled
      console.log('📢 Sending to all users with notifications enabled...');
      query = {
        $or: [
          { oneSignalPlayerId: { $exists: true, $ne: null, $ne: '' } },
          { notificationEmail: { $exists: true, $ne: null, $ne: '' } }
        ],
        dailyNotificationDisabled: { $ne: true },
        lastDailyNotificationDate: { $ne: today }
      };
    } else {
      // Find timezones where it's currently 8am
      const targetTimezones = getTimezonesAt8am();
      results.timezonesChecked = targetTimezones;
      
      if (targetTimezones.length === 0) {
        console.log('⏰ No timezones at 8am right now');
        return { success: true, ...results, message: 'No timezones at 8am' };
      }
      
      console.log(`⏰ Timezones at 8am: ${targetTimezones.join(', ')}`);
      
      query = {
        timezone: { $in: targetTimezones },
        $or: [
          { oneSignalPlayerId: { $exists: true, $ne: null, $ne: '' } },
          { notificationEmail: { $exists: true, $ne: null, $ne: '' } }
        ],
        dailyNotificationDisabled: { $ne: true },
        lastDailyNotificationDate: { $ne: today }
      };
    }
    
    // Find users matching the query
    const users = await AppUser.find(query)
      .select('_id email parentName oneSignalPlayerId timezone reverseTrialActive reverseTrialStartDate reverseTrialConverted');
    
    results.total = users.length;
    console.log(`📊 Found ${users.length} users to notify`);
    
    // Process in batches
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (user) => {
        try {
          const message = getDailyMessage(user, dayOfYear);
          const sendResult = await sendDailyNotification(user, message);
          
          if (sendResult.success) {
            // Mark notification as sent for today
            await AppUser.findByIdAndUpdate(user._id, {
              $set: { lastDailyNotificationDate: today }
            });
            return { sent: true };
          } else {
            return { failed: true };
          }
        } catch (e) {
          console.error(`Error notifying user ${user._id}:`, e.message);
          return { failed: true };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result.sent) results.sent++;
        else if (result.failed) results.failed++;
        else results.skipped++;
      }
      
      // Small delay between batches
      if (i + BATCH_SIZE < users.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✨ Daily engagement job completed in ${duration}s`);
    console.log(`   Total: ${results.total}, Sent: ${results.sent}, Failed: ${results.failed}`);
    
    return { success: true, duration: `${duration}s`, ...results };
    
  } catch (error) {
    console.error('❌ Daily engagement job failed:', error);
    return { success: false, error: error.message, ...results };
  }
}

/**
 * Update user's timezone
 */
async function updateUserTimezone(userId, timezone) {
  try {
    // Validate timezone
    const testHour = getHourInTimezone(timezone);
    if (testHour === null) {
      return { success: false, error: 'Invalid timezone' };
    }
    
    await AppUser.findByIdAndUpdate(userId, {
      $set: { timezone: timezone }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating timezone:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Toggle daily notifications for a user
 */
async function toggleDailyNotifications(userId, enabled) {
  try {
    await AppUser.findByIdAndUpdate(userId, {
      $set: { dailyNotificationDisabled: !enabled }
    });
    return { success: true, enabled };
  } catch (error) {
    console.error('Error toggling notifications:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  runDailyEngagementNotifications,
  updateUserTimezone,
  toggleDailyNotifications,
  getDailyMessage,
  getTrialDay,
  DAILY_MESSAGES,
  TRIAL_MESSAGES,
};
