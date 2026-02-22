const express = require('express');
const router = express.Router();

// Initialize Stripe with secret key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Stripe Price IDs (from your Stripe dashboard)
// Annual: $39.99/year, Monthly: $5.99/month, Lifetime: $69.99 one-time
const PRICE_IDS = {
  annual: process.env.STRIPE_PRICE_ANNUAL || 'price_annual_placeholder',
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_placeholder',
  lifetime: process.env.STRIPE_PRICE_LIFETIME || 'price_lifetime_placeholder',
};

/**
 * GET /api/stripe/create-checkout-session
 * Info endpoint - tells users to use POST
 */
router.get('/create-checkout-session', (req, res) => {
  res.json({ 
    message: 'Stripe checkout endpoint is working! Use POST method with: plan, userId, email, successUrl, cancelUrl',
    method: 'POST required',
    example: {
      plan: 'annual, monthly, or lifetime',
      userId: 'user-id',
      email: 'user@example.com',
      successUrl: 'https://app.godlykids.com/#/payment-success',
      cancelUrl: 'https://app.godlykids.com/#/paywall'
    }
  });
});

/**
 * POST /api/stripe/create-checkout-session
 * Creates a Stripe Checkout session for web purchases
 */
router.post('/create-checkout-session', async (req, res) => {
  console.log('🛒 Stripe create-checkout-session called');
  console.log('   Body:', JSON.stringify(req.body));
  
  try {
    const { plan, userId, email, successUrl, cancelUrl } = req.body;

    if (!plan || !['annual', 'monthly', 'lifetime'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "annual", "monthly", or "lifetime"' });
    }

    const priceId = PRICE_IDS[plan];
    
    if (!priceId || priceId.includes('placeholder')) {
      return res.status(500).json({ error: 'Stripe price not configured. Please contact support.' });
    }

    console.log('🛒 Creating Stripe checkout session:', { plan, userId, email });

    // Lifetime is a one-time payment, others are subscriptions
    const isLifetime = plan === 'lifetime';

    // Build checkout session options
    const sessionOptions = {
      mode: isLifetime ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.FRONTEND_URL || 'https://app.godlykids.com'}/#/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'https://app.godlykids.com'}/#/paywall`,
      metadata: {
        userId: userId || 'anonymous',
        plan: plan,
      },
      // Allow promotion codes
      allow_promotion_codes: true,
    };

    // Add subscription-specific options (trial period) for non-lifetime plans
    if (!isLifetime) {
      sessionOptions.subscription_data = {
        metadata: {
          userId: userId || 'anonymous',
          plan: plan,
        },
        // 7-day free trial
        trial_period_days: 7,
      };
    }

    // Add customer email if provided
    if (email) {
      sessionOptions.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);

    console.log('✅ Stripe checkout session created:', session.id);

    res.json({ 
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('❌ Stripe checkout error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      message: error.message 
    });
  }
});

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhooks for subscription events
 * NOTE: This route must receive RAW body for signature verification
 * The main app.js excludes this route from JSON parsing
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('📬 Stripe webhook hit');
  
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Check if webhook secret is configured
  if (!endpointSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET is not configured!');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    console.error('   Signature:', sig ? sig.substring(0, 50) + '...' : 'missing');
    console.error('   Body type:', typeof req.body);
    console.error('   Body is Buffer:', Buffer.isBuffer(req.body));
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('📬 Stripe webhook received:', event.type);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('✅ Checkout completed:', session.id);
      
      // Get user ID from metadata
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      
      if (userId && userId !== 'anonymous') {
        // Update user's premium status in database
        try {
          const User = require('../models/User');
          const AppUser = require('../models/AppUser');
          const normalizedUserId = typeof userId === 'string' && userId.includes('@') ? userId.toLowerCase().trim() : userId;

          // Update User collection (auth users)
          await User.findOneAndUpdate(
            { $or: [{ email: normalizedUserId }, { _id: userId }] },
            { isPremium: true, subscriptionPlan: plan },
            { upsert: false }
          );

          // Update AppUser collection - use subscriptionStatus (not isPremium; AppUser schema uses subscriptionStatus)
          let appUser = await AppUser.findOne({
            $or: [{ email: normalizedUserId }, { deviceId: userId }]
          });
          if (appUser) {
            appUser.subscriptionStatus = 'active';
            appUser.subscriptionStartDate = appUser.subscriptionStartDate || new Date();
            appUser.subscriptionPlan = plan;
            await appUser.save();
          } else {
            // User paid but has no AppUser - create one so they get premium (e.g. web-only flow)
            appUser = await AppUser.create({
              email: normalizedUserId.includes('@') ? normalizedUserId : undefined,
              deviceId: normalizedUserId.includes('@') ? undefined : userId,
              subscriptionStatus: 'active',
              subscriptionStartDate: new Date(),
              subscriptionPlan: plan,
            });
          }

          console.log(`✅ Updated premium status for user: ${userId}`);
        } catch (dbError) {
          console.error('❌ Database update error:', dbError);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;
      
      console.log('❌ Subscription cancelled:', subscription.id);
      
      if (userId && userId !== 'anonymous') {
        try {
          const User = require('../models/User');
          const AppUser = require('../models/AppUser');
          const normalizedUserId = typeof userId === 'string' && userId.includes('@') ? userId.toLowerCase().trim() : userId;

          await User.findOneAndUpdate(
            { $or: [{ email: normalizedUserId }, { _id: userId }] },
            { isPremium: false }
          );

          await AppUser.findOneAndUpdate(
            { $or: [{ email: normalizedUserId }, { deviceId: userId }] },
            { subscriptionStatus: 'cancelled' }
          );

          console.log(`✅ Removed premium status for user: ${userId}`);
        } catch (dbError) {
          console.error('❌ Database update error:', dbError);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('⚠️ Payment failed for invoice:', invoice.id);
      break;
    }

    default:
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

/**
 * GET /api/stripe/verify-session/:sessionId
 * Verify a checkout session was successful
 */
router.get('/verify-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid' || session.status === 'complete') {
      res.json({ 
        success: true, 
        isPremium: true,
        plan: session.metadata?.plan,
        customerId: session.customer,
      });
    } else {
      res.json({ 
        success: false, 
        isPremium: false,
        status: session.status,
      });
    }
  } catch (error) {
    console.error('❌ Session verification error:', error);
    res.status(500).json({ error: 'Failed to verify session' });
  }
});

module.exports = router;

