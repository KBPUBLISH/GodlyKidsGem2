const router = require('express').Router();
const Campaign = require('../models/UpdateCampaign');
const Enrollment = require('../models/CampaignEnrollment');
const Subscriber = require('../models/EmailSubscriber');
const { authenticateAdmin } = require('../middleware/auth');
const { emailFromToken, escapeHtml, validateMessages } = require('../services/campaignPolicy');
const { enroll, runUpdate, render } = require('../services/updateCampaign');
const { configuration } = require('../services/campaignDelivery');

// GET only displays confirmation: link scanners must not unsubscribe people.
router.get('/unsubscribe', (req, res) => {
  try {
    const email = emailFromToken(req.query.token, process.env.EMAIL_UNSUBSCRIBE_SECRET);
    if (!email) return res.status(400).send('Invalid unsubscribe link');
    res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer').type('html').send(
      `<h1>Godly Kids email preferences</h1><form method="post"><input type="hidden" name="token" value="${escapeHtml(req.query.token)}"><button>Unsubscribe from updates</button></form>`);
  } catch { res.status(503).send('Email preferences temporarily unavailable'); }
});
router.post('/unsubscribe', async (req, res) => {
  try {
    const email = emailFromToken(req.query.token || req.body?.token, process.env.EMAIL_UNSUBSCRIBE_SECRET);
    if (!email) return res.status(400).send('Invalid unsubscribe link');
    await Subscriber.updateOne({ email }, { $set: { optInUpdates: false, unsubscribedAt: new Date() }, $setOnInsert: { source: 'other' } }, { upsert: true });
    res.send('You have been unsubscribed from Godly Kids updates.');
  } catch { res.status(503).send('Unable to save preferences. Please try again.'); }
});
router.use(authenticateAdmin);
router.post('/', async (req, res) => {
  try {
    const { key, messages = [], appUrl = 'https://app.godlykids.com/' } = req.body || {};
    if (!/^update-[a-z0-9-]{1,80}$/.test(key || '')) return res.status(400).json({ error: 'Use a unique update- campaign key' });
    if (messages.length) validateMessages(messages, appUrl);
    const campaign = await Campaign.create({ key, messages, appUrl, audienceCutoff: new Date(), status: 'draft' });
    res.status(201).json(campaign);
  } catch (error) { res.status(400).json({ error: error.code === 11000 ? 'Campaign already exists' : error.message }); }
});
router.put('/:key', async (req, res) => {
  try {
    const { messages, appUrl } = req.body || {};
    validateMessages(messages, appUrl);
    const campaign = await Campaign.findOneAndUpdate({ key: req.params.key, status: 'draft' }, { $set: { messages, appUrl } }, { new: true });
    if (!campaign) return res.status(409).json({ error: 'Only draft campaigns can be edited' });
    res.json(campaign);
  } catch (error) { res.status(400).json({ error: error.message }); }
});
router.get('/:key', async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ key: req.params.key }).lean();
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign, previewHtml: campaign.messages.map(m => render(m, 'Parent', campaign.appUrl)),
      audience: await enroll(campaign, true),
      queue: await Enrollment.aggregate([{ $match: { campaign: campaign.key } }, { $group: { _id: '$status', count: { $sum: 1 } } }]) });
  } catch { res.status(500).json({ error: 'Unable to preview campaign' }); }
});
router.post('/:key/launch', async (req, res) => {
  try {
    configuration();
    let campaign = await Campaign.findOne({ key: req.params.key });
    if (!campaign || campaign.status === 'paused') return res.status(409).json({ error: 'Campaign missing or paused' });
    validateMessages(campaign.messages, campaign.appUrl);
    // Atomic transition fixes the original audience and start time. Repeating launch resumes enrollment safely.
    campaign = await Campaign.findOneAndUpdate({ key: campaign.key, status: 'draft' },
      { $set: { status: 'active', launchedAt: new Date() } }, { new: true }) || await Campaign.findOne({ key: req.params.key });
    res.json({ status: campaign.status, audience: await enroll(campaign, false) });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
router.post('/:key/pause', async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate({ key: req.params.key, status: 'active' }, { $set: { status: 'paused' } }, { new: true });
    if (!campaign) return res.status(409).json({ error: 'Campaign is not active' });
    res.json({ status: campaign.status });
  } catch { res.status(500).json({ error: 'Unable to pause campaign' }); }
});
router.post('/:key/resume', async (req, res) => {
  try {
    configuration();
    const campaign = await Campaign.findOneAndUpdate({ key: req.params.key, status: 'paused' }, { $set: { status: 'active' } }, { new: true });
    if (!campaign) return res.status(409).json({ error: 'Campaign is not paused' });
    res.json({ status: campaign.status });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
router.post('/:key/run', async (req, res) => {
  try { res.json(await runUpdate(req.params.key, { limit: req.body?.limit ?? 100, dryRun: req.body?.dryRun !== false })); }
  catch (error) { res.status(400).json({ error: error.message }); }
});
module.exports = router;
