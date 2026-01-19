const express = require('express');
const router = express.Router();
const EmailSubscriber = require('../models/EmailSubscriber');

// Try to load auth middleware, but don't fail if missing
let authenticateAdmin;
try {
  const auth = require('../middleware/auth');
  authenticateAdmin = auth.authenticateAdmin;
} catch (err) {
  console.warn('⚠️ Auth middleware not found, using passthrough for admin routes');
  // Fallback: allow all requests (temporary for debugging)
  authenticateAdmin = (req, res, next) => next();
}

// POST /api/email-subscribers - Subscribe an email (public endpoint for app)
router.post('/', async (req, res) => {
  try {
    const { email, source, platform, deviceId, parentName, kidsCount, optInUpdates } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email already exists
    const existingSubscriber = await EmailSubscriber.findOne({ email: email.toLowerCase() });
    
    if (existingSubscriber) {
      // If already subscribed but unsubscribed, re-subscribe
      if (existingSubscriber.unsubscribedAt) {
        existingSubscriber.unsubscribedAt = null;
        existingSubscriber.optInUpdates = optInUpdates !== false;
        await existingSubscriber.save();
        return res.status(200).json({ 
          message: 'Re-subscribed successfully',
          bonusAwarded: existingSubscriber.bonusAwarded,
          isNewSubscriber: false
        });
      }
      
      // Already subscribed and active
      return res.status(200).json({ 
        message: 'Email already subscribed',
        bonusAwarded: existingSubscriber.bonusAwarded,
        isNewSubscriber: false
      });
    }

    // Create new subscriber
    const subscriber = new EmailSubscriber({
      email: email.toLowerCase(),
      source: source || 'onboarding_bonus',
      platform: platform || 'unknown',
      deviceId,
      parentName,
      kidsCount,
      optInUpdates: optInUpdates !== false,
      bonusAwarded: true, // Mark bonus as awarded for new subscribers from onboarding
      bonusAmount: 200,
    });

    await subscriber.save();

    res.status(201).json({
      message: 'Subscribed successfully',
      bonusAwarded: true,
      bonusAmount: 200,
      isNewSubscriber: true
    });
  } catch (error) {
    console.error('Error subscribing email:', error);
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(200).json({ 
        message: 'Email already subscribed',
        bonusAwarded: true,
        isNewSubscriber: false
      });
    }
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// GET /api/email-subscribers - List all subscribers (admin only)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, source, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = {};
    
    if (source) {
      query.source = source;
    }
    
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { parentName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [subscribers, total] = await Promise.all([
      EmailSubscriber.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      EmailSubscriber.countDocuments(query)
    ]);

    // Get stats
    const stats = await EmailSubscriber.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalBonusAwarded: { $sum: { $cond: ['$bonusAwarded', 1, 0] } },
          totalOptedIn: { $sum: { $cond: ['$optInUpdates', 1, 0] } },
          totalUnsubscribed: { $sum: { $cond: [{ $ne: ['$unsubscribedAt', null] }, 1, 0] } },
          bySource: {
            $push: '$source'
          }
        }
      }
    ]);

    const sourceStats = await EmailSubscriber.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    res.json({
      subscribers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        total: stats[0]?.total || 0,
        bonusAwarded: stats[0]?.totalBonusAwarded || 0,
        optedIn: stats[0]?.totalOptedIn || 0,
        unsubscribed: stats[0]?.totalUnsubscribed || 0,
        bySource: sourceStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {})
      }
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// GET /api/email-subscribers/export - Export all emails as CSV (admin only)
router.get('/export', authenticateAdmin, async (req, res) => {
  try {
    const subscribers = await EmailSubscriber.find({ optInUpdates: true, unsubscribedAt: null })
      .select('email parentName createdAt source platform')
      .sort({ createdAt: -1 })
      .lean();

    const csv = [
      'Email,Parent Name,Subscribed Date,Source,Platform',
      ...subscribers.map(s => 
        `${s.email},"${s.parentName || ''}",${s.createdAt?.toISOString() || ''},${s.source},${s.platform}`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=godlykids-subscribers.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting subscribers:', error);
    res.status(500).json({ error: 'Failed to export subscribers' });
  }
});

// DELETE /api/email-subscribers/:id - Remove a subscriber (admin only)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const subscriber = await EmailSubscriber.findByIdAndDelete(req.params.id);
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    res.json({ message: 'Subscriber removed' });
  } catch (error) {
    console.error('Error removing subscriber:', error);
    res.status(500).json({ error: 'Failed to remove subscriber' });
  }
});

// POST /api/email-subscribers/unsubscribe - Unsubscribe an email
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    const subscriber = await EmailSubscriber.findOne({ email: email?.toLowerCase() });
    if (!subscriber) {
      return res.status(404).json({ error: 'Email not found' });
    }

    subscriber.unsubscribedAt = new Date();
    subscriber.optInUpdates = false;
    await subscriber.save();

    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

module.exports = router;
