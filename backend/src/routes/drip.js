const router = require('express').Router();
const { runWelcome } = require('../services/welcomeCampaign');
const AppUser = require('../models/AppUser');
const { STAGES } = require('../services/campaignPolicy');
// Keep compatibility with existing external cron callers.
router.use((req, res, next) => {
  const expected = process.env.ADMIN_API_KEY || process.env.MIGRATION_API_KEY;
  const supplied = req.headers['x-admin-api-key'] || req.headers['x-migration-api-key'];
  if (!expected || supplied !== expected) return res.status(401).json({ error: 'Invalid or missing admin API key' });
  next();
});
router.post('/run', async (req, res) => {
  try { res.json(await runWelcome({ limit: req.body?.limit ?? 100, dryRun: req.body?.dryRun !== false })); }
  catch (error) { res.status(400).json({ error: error.message }); }
});
router.get('/status', async (req, res) => {
  try { res.json({ enabled: process.env.EMAIL_CAMPAIGNS_ENABLED === 'true',
    completedDripSequence: await AppUser.countDocuments({ dripCompleted: true }), stages: STAGES }); }
  catch { res.status(500).json({ error: 'Unable to read drip status' }); }
});
module.exports = router;
