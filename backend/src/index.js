require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { 
  generalLimiter, 
  authLimiter, 
  ttsLimiter, 
  quizLimiter, 
  uploadLimiter,
  analyticsLimiter 
} = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5001;

// Trust first proxy (Render, etc.) so X-Forwarded-For is used and rate-limit identifies clients correctly
app.set('trust proxy', 1);

// ===========================================
// SECURITY MIDDLEWARE
// ===========================================

// Helmet - Security headers (XSS protection, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin for assets
  contentSecurityPolicy: false, // Disable CSP for API
}));

// CORS - Allow all origins for flexibility (mobile apps, web, etc.)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow any godlykids or netlify subdomain - no logging spam
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));

// ===========================================
// BODY PARSING & RATE LIMITING
// ===========================================

// Body parsing with size limits
// IMPORTANT: Skip JSON parsing for Stripe webhook - it needs raw body for signature verification
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next(); // Skip JSON parsing for webhook
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Apply general rate limiter to all routes
app.use(generalLimiter);

// ===========================================
// DATABASE CONNECTION
// ===========================================
connectDB();

// ===========================================
// STATIC FILES
// ===========================================
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ===========================================
// API ROUTES (with specific rate limiters)
// ===========================================

// Auth routes - stricter rate limiting
app.use('/api/authentication', authLimiter, require('./routes/authentication'));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/password-reset', authLimiter, require('./routes/passwordReset'));

// TTS routes - expensive operation
app.use('/api/tts', ttsLimiter, require('./routes/tts'));

// Quiz routes - AI-intensive
app.use('/api/quiz', quizLimiter, require('./routes/quiz'));

// Upload routes
app.use('/api/upload', uploadLimiter, require('./routes/upload'));

// Analytics routes
app.use('/api/analytics', analyticsLimiter, require('./routes/analytics'));

// Standard routes (use general limiter already applied)
app.use('/api/books', require('./routes/books'));
app.use('/api/book-series', require('./routes/bookSeries'));
app.use('/api/pages', require('./routes/pages'));
app.use('/api/playlists', require('./routes/playlists'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/voices', require('./routes/voices'));
app.use('/api/voice-cloning', require('./routes/voiceCloning'));
app.use('/api/games', require('./routes/games'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/music', require('./routes/music'));
app.use('/api/migration', require('./routes/migration'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/drip', require('./routes/drip'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/translate', require('./routes/translate'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/featured', require('./routes/featured'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/user-playlists', require('./routes/userPlaylists'));
app.use('/api/ai', require('./routes/aiGenerate'));
app.use('/api/book-comments', require('./routes/bookComments'));
app.use('/api/playlist-comments', require('./routes/playlistComments'));
app.use('/api/play-events', require('./routes/playEvents'));
app.use('/api/google-tts', ttsLimiter, require('./routes/googleTts'));
app.use('/api/radio', require('./routes/radio'));
app.use('/api/parent-quiz', require('./routes/parentQuiz'));
app.use('/api/email-subscribers', require('./routes/emailSubscribers'));
app.use('/api/meta', require('./routes/metaConversions'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/campaign-updates', require('./routes/campaignUpdates'));
app.use('/api/app-user', require('./routes/appUser'));
app.use('/api/amazon-books', require('./routes/amazonBooks'));

// Godly Hub - Creator marketplace
app.use('/api/creator', authLimiter, require('./routes/creatorAuth'));
app.use('/api/tokens', require('./routes/tokens'));
app.use('/api/hub', require('./routes/hub'));

// Surveys & Feedback
app.use('/api/survey', require('./routes/survey'));

// Character Generation (Personalized Stories)
app.use('/api/character', require('./routes/character'));

// Devotional Stories (Personalized Stories)
app.use('/api/devotional-stories', require('./routes/devotional-stories'));

// Background Music Library (for Devotional Stories)
app.use('/api/background-music', require('./routes/background-music'));

// Character Poses (for Illustrated Stories)
app.use('/api/character-poses', require('./routes/character-poses'));

// AI Character Placement (analyzes backgrounds for optimal character positioning)
app.use('/api/character-placement', require('./routes/character-placement'));

// Story Backgrounds Library (for Illustrated Stories)
app.use('/api/story-backgrounds', require('./routes/story-backgrounds'));

// Monthly Custom Book (create your story with Bible character)
app.use('/api/monthly-book', require('./routes/monthly-book'));

// ===========================================
// HEALTH & STATUS ENDPOINTS
// ===========================================

app.get('/', (req, res) => {
  res.send('Godly Kids Backend API is running');
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message 
  });
});

// ===========================================
// SCHEDULED JOBS (Internal Cron)
// ===========================================
let cron, runDailyEngagementNotifications, runReverseTrialNotifications, expireEndedTrials;
try {
  cron = require('node-cron');
  const dailyNotifier = require('./jobs/dailyEngagementNotifier');
  runDailyEngagementNotifications = dailyNotifier.runDailyEngagementNotifications;
  const trialNotifier = require('./jobs/reverseTrialNotifier');
  runReverseTrialNotifications = trialNotifier.runReverseTrialNotifications;
  expireEndedTrials = trialNotifier.expireEndedTrials;
  console.log('✅ Cron dependencies loaded successfully');
} catch (cronError) {
  console.error('❌ Failed to load cron dependencies:', cronError.message);
  cron = null;
}

// Only set up cron jobs if cron loaded successfully
if (cron) {
// Morning scripture at 7am Mountain Time - just uplifting, no call to action
cron.schedule('0 7 * * *', async () => {
  console.log('🌅 [Cron] Running 7am morning scripture notifications...');
  try {
    const result = await runDailyEngagementNotifications({ ignoreTimezone: true, morningScripture: true });
    console.log('✅ [Cron] Morning scripture job completed:', result.sent, 'notifications sent');
  } catch (error) {
    console.error('❌ [Cron] Morning scripture job failed:', error.message);
  }
}, {
  timezone: 'America/Denver'
});

// Afternoon engagement at 2pm Mountain Time - call to action
cron.schedule('0 14 * * *', async () => {
  console.log('⏰ [Cron] Running 2pm daily engagement notifications...');
  try {
    const result = await runDailyEngagementNotifications({ ignoreTimezone: true });
    console.log('✅ [Cron] Daily engagement job completed:', result.sent, 'notifications sent');
  } catch (error) {
    console.error('❌ [Cron] Daily engagement job failed:', error.message);
  }
}, {
  timezone: 'America/Denver'
});

// Run reverse trial notifications every 6 hours (reminders for expiring trials)
cron.schedule('0 */6 * * *', async () => {
  console.log('⏰ [Cron] Running reverse trial notifications check...');
  try {
    await expireEndedTrials();
    const result = await runReverseTrialNotifications();
    console.log('✅ [Cron] Reverse trial job completed:', result);
  } catch (error) {
    console.error('❌ [Cron] Reverse trial job failed:', error.message);
  }
});

  console.log('📅 Scheduled jobs initialized');
} else {
  console.log('⚠️ Cron not available - scheduled jobs disabled');
}

// ===========================================
// START SERVER
// ===========================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
