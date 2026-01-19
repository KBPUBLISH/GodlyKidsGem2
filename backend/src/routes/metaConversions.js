const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * Meta Conversions API Integration
 * 
 * Tracks app installs and events server-side for better attribution
 * from Meta ad campaigns.
 * 
 * Required Environment Variables:
 * - META_PIXEL_ID: Your Facebook Pixel ID
 * - META_ACCESS_TOKEN: Conversions API access token from Meta Events Manager
 */

// Dataset ID for Conversions API (Godly Kids dataset)
const DATASET_ID = process.env.META_DATASET_ID || '1372889104031125';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const API_VERSION = 'v18.0';
const META_API_URL = `https://graph.facebook.com/${API_VERSION}/${DATASET_ID}/events`;

// Hash function for user data (Meta requires SHA256 hashing)
const hashData = (data) => {
  if (!data) return null;
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
};

// Send event to Meta Conversions API
const sendToMeta = async (eventData) => {
  if (!ACCESS_TOKEN) {
    console.warn('⚠️ META_ACCESS_TOKEN not set - skipping Meta Conversions API');
    return { success: false, error: 'No access token configured' };
  }

  try {
    const response = await fetch(`${META_API_URL}?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [eventData],
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Meta Conversions API event sent:', eventData.event_name);
      return { success: true, result };
    } else {
      console.error('❌ Meta Conversions API error:', result);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error('❌ Meta Conversions API request failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * POST /api/meta/app-install
 * Track app installation event
 */
router.post('/app-install', async (req, res) => {
  try {
    const {
      // User identifiers (will be hashed)
      email,
      phone,
      // Device/browser info
      userAgent,
      ip,
      // Attribution data from deep link or URL params
      fbclid,      // Facebook click ID from ad
      fbp,         // Facebook browser ID (_fbp cookie)
      fbc,         // Facebook click ID cookie (_fbc)
      // App info
      platform,    // 'ios', 'android', 'web'
      appVersion,
      deviceId,
    } = req.body;

    // Get client IP from request if not provided
    const clientIp = ip || req.ip || req.headers['x-forwarded-for']?.split(',')[0];
    const clientUserAgent = userAgent || req.headers['user-agent'];

    // Build user data object with hashed PII
    const userData = {
      client_ip_address: clientIp,
      client_user_agent: clientUserAgent,
    };

    // Add hashed identifiers if provided
    if (email) userData.em = [hashData(email)];
    if (phone) userData.ph = [hashData(phone)];
    
    // Add Facebook tracking parameters if available
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    // Build the event
    const eventData = {
      event_name: 'AppInstall',
      event_time: Math.floor(Date.now() / 1000),
      action_source: platform === 'web' ? 'website' : 'app',
      user_data: userData,
      custom_data: {
        platform: platform || 'unknown',
        app_version: appVersion,
        device_id: deviceId,
      },
    };

    // Add fbclid to event if present (important for attribution)
    if (fbclid) {
      eventData.custom_data.fbclid = fbclid;
    }

    const result = await sendToMeta(eventData);
    
    res.json({
      success: result.success,
      message: result.success ? 'App install tracked' : 'Failed to track',
      ...result,
    });
  } catch (error) {
    console.error('App install tracking error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/meta/event
 * Track custom events (Purchase, Subscribe, Lead, etc.)
 */
router.post('/event', async (req, res) => {
  try {
    const {
      eventName,
      // User identifiers
      email,
      phone,
      userId,
      // Device info
      userAgent,
      ip,
      // Facebook tracking
      fbclid,
      fbp,
      fbc,
      // Event-specific data
      value,
      currency,
      contentName,
      contentCategory,
      customData,
    } = req.body;

    if (!eventName) {
      return res.status(400).json({ success: false, error: 'eventName is required' });
    }

    const clientIp = ip || req.ip || req.headers['x-forwarded-for']?.split(',')[0];
    const clientUserAgent = userAgent || req.headers['user-agent'];

    // Build user data
    const userData = {
      client_ip_address: clientIp,
      client_user_agent: clientUserAgent,
    };

    if (email) userData.em = [hashData(email)];
    if (phone) userData.ph = [hashData(phone)];
    if (userId) userData.external_id = [hashData(userId)];
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    // Build event data
    const eventData = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'app',
      user_data: userData,
      custom_data: {
        ...customData,
      },
    };

    // Add standard parameters if provided
    if (value !== undefined) eventData.custom_data.value = value;
    if (currency) eventData.custom_data.currency = currency;
    if (contentName) eventData.custom_data.content_name = contentName;
    if (contentCategory) eventData.custom_data.content_category = contentCategory;

    const result = await sendToMeta(eventData);
    
    res.json({
      success: result.success,
      message: result.success ? `Event ${eventName} tracked` : 'Failed to track',
      ...result,
    });
  } catch (error) {
    console.error('Event tracking error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/meta/purchase
 * Track purchase/subscription events (important for ROAS)
 */
router.post('/purchase', async (req, res) => {
  try {
    const {
      email,
      userId,
      value,
      currency = 'USD',
      plan,
      transactionId,
      fbp,
      fbc,
      userAgent,
      ip,
    } = req.body;

    if (!value) {
      return res.status(400).json({ success: false, error: 'value is required' });
    }

    const clientIp = ip || req.ip || req.headers['x-forwarded-for']?.split(',')[0];
    const clientUserAgent = userAgent || req.headers['user-agent'];

    const userData = {
      client_ip_address: clientIp,
      client_user_agent: clientUserAgent,
    };

    if (email) userData.em = [hashData(email)];
    if (userId) userData.external_id = [hashData(userId)];
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    const eventData = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'app',
      user_data: userData,
      custom_data: {
        value: value,
        currency: currency,
        content_name: plan,
        content_category: 'Subscription',
        order_id: transactionId,
        predicted_ltv: value * 12, // Assuming annual LTV
      },
    };

    const result = await sendToMeta(eventData);
    
    res.json({
      success: result.success,
      message: result.success ? 'Purchase tracked' : 'Failed to track',
      ...result,
    });
  } catch (error) {
    console.error('Purchase tracking error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/meta/test
 * Test the Meta Conversions API connection
 */
router.get('/test', async (req, res) => {
  const hasToken = !!ACCESS_TOKEN;
  
  if (!hasToken) {
    return res.json({
      configured: false,
      message: 'META_ACCESS_TOKEN environment variable not set',
      datasetId: DATASET_ID,
    });
  }

  // Send a test event
  const testEvent = {
    event_name: 'TestEvent',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'app',
    user_data: {
      client_ip_address: req.ip,
      client_user_agent: req.headers['user-agent'],
    },
  };

  const result = await sendToMeta(testEvent);
  
  res.json({
    configured: true,
    datasetId: DATASET_ID,
    testResult: result,
  });
});

module.exports = router;
