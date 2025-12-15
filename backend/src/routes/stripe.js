const express = require('express');
const router = express.Router();
const Influencer = require('../models/Influencer');

// Stripe product IDs
const STRIPE_PRODUCTS = {
    annual: 'prod_T92LYMIg4OKLux',
    monthly: 'prod_T92L8tfRKXxQTS'
};

// Note: You'll need to install stripe: npm install stripe
// And set STRIPE_SECRET_KEY in your environment variables
let stripe;
try {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
} catch (err) {
    console.warn('⚠️ Stripe not initialized - STRIPE_SECRET_KEY not set');
}

// POST /api/stripe/create-checkout - Create a Stripe checkout session
router.post('/create-checkout', async (req, res) => {
    try {
        const { email, plan, promoCode, influencerCode, successUrl, cancelUrl } = req.body;

        if (!stripe) {
            return res.status(500).json({ 
                message: 'Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.' 
            });
        }

        if (!email || !plan) {
            return res.status(400).json({ message: 'Email and plan are required' });
        }

        const productId = STRIPE_PRODUCTS[plan];
        if (!productId) {
            return res.status(400).json({ message: 'Invalid plan selected' });
        }

        console.log(`🔵 Creating Stripe checkout for ${email}, plan: ${plan}`);

        // Look up the product to get its default price
        const product = await stripe.products.retrieve(productId);
        const priceId = product.default_price;

        if (!priceId) {
            console.error(`❌ No default price found for product ${productId}`);
            return res.status(500).json({ message: 'Product configuration error' });
        }

        // Build checkout session parameters
        const sessionParams = {
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: email,
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            success_url: successUrl || `${req.headers.origin || 'https://app.godlykids.com'}/#/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${req.headers.origin || 'https://app.godlykids.com'}/#/checkout-cancelled`,
            subscription_data: {
                trial_period_days: 3, // Default trial
                metadata: {
                    influencer_code: influencerCode || '',
                    source: 'web_checkout'
                }
            },
            metadata: {
                influencer_code: influencerCode || '',
                email: email
            }
        };

        // Apply promo code if provided
        if (promoCode) {
            try {
                // Look up the promotion code in Stripe
                const promotionCodes = await stripe.promotionCodes.list({
                    code: promoCode,
                    active: true,
                    limit: 1
                });

                if (promotionCodes.data.length > 0) {
                    sessionParams.discounts = [{
                        promotion_code: promotionCodes.data[0].id
                    }];
                    console.log(`✅ Applied promo code: ${promoCode}`);
                } else {
                    console.log(`⚠️ Promo code not found or inactive: ${promoCode}`);
                    // Don't fail - just proceed without discount
                }
            } catch (promoErr) {
                console.error(`⚠️ Error looking up promo code: ${promoErr.message}`);
                // Don't fail - just proceed without discount
            }
        }

        // If influencer code provided, update trial days based on influencer settings
        if (influencerCode) {
            try {
                const influencer = await Influencer.findOne({ 
                    code: influencerCode.toUpperCase(), 
                    isActive: true 
                });
                if (influencer && influencer.trialDays) {
                    sessionParams.subscription_data.trial_period_days = influencer.trialDays;
                    console.log(`📊 Using influencer trial days: ${influencer.trialDays}`);
                }
            } catch (infErr) {
                console.error(`⚠️ Error looking up influencer: ${infErr.message}`);
            }
        }

        // Create the checkout session
        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log(`✅ Checkout session created: ${session.id}`);
        
        res.json({
            checkoutUrl: session.url,
            sessionId: session.id
        });

    } catch (error) {
        console.error('❌ Error creating Stripe checkout:', error);
        res.status(500).json({ 
            message: error.message || 'Failed to create checkout session' 
        });
    }
});

// POST /api/stripe/webhook - Handle Stripe webhooks (for tracking conversions)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set');
        return res.status(400).json({ message: 'Webhook not configured' });
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('⚠️ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log(`✅ Checkout completed: ${session.id}`);
            
            // Track influencer conversion if applicable
            const influencerCode = session.metadata?.influencer_code;
            if (influencerCode) {
                try {
                    await Influencer.findOneAndUpdate(
                        { code: influencerCode.toUpperCase(), isActive: true },
                        { 
                            $inc: { 
                                'stats.conversions': 1,
                                'stats.totalRevenue': session.amount_total / 100 // Convert cents to dollars
                            } 
                        }
                    );
                    console.log(`📊 Tracked conversion for influencer: ${influencerCode}`);
                } catch (err) {
                    console.error(`❌ Failed to track influencer conversion: ${err.message}`);
                }
            }
            break;

        case 'customer.subscription.created':
            console.log(`📬 Subscription created: ${event.data.object.id}`);
            break;

        case 'customer.subscription.updated':
            console.log(`📬 Subscription updated: ${event.data.object.id}`);
            break;

        case 'customer.subscription.deleted':
            console.log(`📬 Subscription cancelled: ${event.data.object.id}`);
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

// GET /api/stripe/session/:sessionId - Get session details (for success page)
router.get('/session/:sessionId', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ message: 'Stripe not configured' });
        }

        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
        
        res.json({
            email: session.customer_email,
            status: session.status,
            paymentStatus: session.payment_status,
            subscriptionId: session.subscription
        });
    } catch (error) {
        console.error('❌ Error retrieving session:', error);
        res.status(500).json({ message: 'Failed to retrieve session' });
    }
});

module.exports = router;

