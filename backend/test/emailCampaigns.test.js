const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const policy = require('../src/services/campaignPolicy');
const User = require('../src/models/User');
const AppUser = require('../src/models/AppUser');
const Subscriber = require('../src/models/EmailSubscriber');
const Delivery = require('../src/models/EmailDelivery');
const Campaign = require('../src/models/UpdateCampaign');
const Enrollment = require('../src/models/CampaignEnrollment');
const sender = require('../src/services/campaignDelivery');
const { runWelcome } = require('../src/services/welcomeCampaign');
const { enroll, runUpdate, render } = require('../src/services/updateCampaign');
let mongo, server, base;
let sent = [], failSMTP = false;
nodemailer.createTransport = () => ({ sendMail: async message => {
  sent.push(message);
  if (failSMTP) throw new Error('Ambiguous connection failure');
  return { accepted: [message.to], messageId: 'test-id' };
} });
const messages = [0, 1, 2].map(i => ({ subject: 'Update ' + i, body: 'Explore Godly Kids together.', cta: 'Open Godly Kids' }));
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User, AppUser, Subscriber, Delivery, Campaign, Enrollment].map(m => m.init()));
  process.env.EMAIL_CAMPAIGNS_ENABLED = 'true';
  process.env.EMAIL_USER = 'sender@example.com';
  process.env.EMAIL_PASSWORD = 'test-only';
  process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-only-secret-at-least-32-characters';
  process.env.PUBLIC_API_URL = 'https://api.example.com';
  process.env.ADMIN_API_KEY = 'test-admin';
  const app = require('express')();
  app.use(require('express').json());
  app.use(require('express').urlencoded({ extended: false }));
  app.use('/api/email-campaigns', require('../src/routes/emailCampaigns'));
  app.use('/api/email-subscribers', require('../src/routes/emailSubscribers'));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(r => server.close(r)); await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => {
  await Promise.all([User, AppUser, Subscriber, Delivery, Campaign, Enrollment].map(m => m.deleteMany({})));
  sent = []; failSMTP = false; process.env.EMAIL_CAMPAIGNS_ENABLED = 'true';
});
async function subscriber(email = 'parent@example.com', extra = {}) { return Subscriber.create({ email, optInUpdates: true, ...extra }); }
async function campaign() { return Campaign.create({ key: 'update-test', audienceCutoff: new Date(), status: 'active', launchedAt: new Date(), messages }); }
async function request(path, body, admin = false, method = 'POST') {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(admin ? { 'x-admin-key': 'test-admin' } : {}) }, ...(method !== 'GET' ? { body: JSON.stringify(body || {}) } : {}) });
}
test('schema persists legacy drip dates and stage selection enforces a 24-hour minimum gap', async () => {
  const now = new Date();
  const user = await AppUser.create({ email: 'p@example.com', dripEmailsSent: { day0_welcome: now }, lastDripEmailAt: now, dripCompleted: true });
  const read = await AppUser.findById(user._id).lean();
  assert.ok(read.dripEmailsSent.day0_welcome); assert.equal(read.dripCompleted, true);
  assert.equal(policy.getDripStage(new Date(now - 7 * policy.DAY), { day0_welcome: now }, now, now), null);
  assert.equal(policy.getDripStage(new Date(now - 7 * policy.DAY), { day0_welcome: now }, new Date(now - 2 * policy.DAY), now), 'day2_tips');
});
test('concurrent deliveries send once and ambiguous SMTP failures are never automatically retried', async () => {
  await subscriber();
  const msg = { campaign: 'update-test', email: ' Parent@Example.com ', stage: '0', subject: 'Hi', html: '<p>Hello</p>' };
  await Promise.all([sender.deliver(msg), sender.deliver(msg), sender.deliver(msg)]);
  assert.equal(sent.length, 1); assert.match(sent[0].html, /Unsubscribe/); assert.ok(sent[0].headers['List-Unsubscribe']);
  failSMTP = true;
  await assert.rejects(sender.deliver({ ...msg, stage: '1' }));
  assert.equal(await sender.deliver({ ...msg, stage: '1' }), 'already_claimed');
  assert.equal(sent.length, 2);
  assert.equal((await Delivery.findOne({ stage: '1' })).status, 'needs_review');
});
test('welcome dry run sends nothing; parallel live runs persist one delivery and skip opt-outs', async () => {
  await subscriber();
  await subscriber('out@example.com', { unsubscribedAt: new Date(), optInUpdates: false });
  await AppUser.create([{ email: 'parent@example.com', parentName: '<Parent>' }, { email: 'out@example.com' }]);
  assert.equal((await runWelcome()).eligible, 1); assert.equal(sent.length, 0); assert.equal(await Delivery.countDocuments(), 0);
  await Promise.all([runWelcome({ dryRun: false }), runWelcome({ dryRun: false })]);
  assert.equal(sent.length, 1); assert.match(sent[0].html, /&lt;Parent&gt;/);
  assert.ok((await AppUser.findOne({ email: 'parent@example.com' }).lean()).dripEmailsSent.day0_welcome);
  await runWelcome({ dryRun: false }); assert.equal(sent.length, 1);
});
test('existing audience excludes new accounts and opt-outs, normalizes duplicates, and enrolls idempotently', async () => {
  await subscriber(); await subscriber('new@example.com');
  const c = await campaign();
  await User.collection.insertMany([
    { username: 'parent', email: 'parent@example.com', createdAt: new Date(c.audienceCutoff - 1000) },
    { username: 'duplicate', email: ' PARENT@example.com ', createdAt: new Date(c.audienceCutoff - 1000) },
    { username: 'excluded', email: 'no-consent@example.com', createdAt: new Date(c.audienceCutoff - 1000) },
    { username: 'new', email: 'new@example.com', createdAt: new Date(+c.audienceCutoff + 1000) },
  ]);
  assert.equal((await enroll(c)).eligible, 1); assert.equal(await Enrollment.countDocuments(), 0);
  await Promise.all([enroll(c, false), enroll(c, false)]);
  assert.equal(await Enrollment.countDocuments(), 1);
});
test('update queue respects actual delivery spacing, deduplicates concurrent runs and stops on unsubscribe', async () => {
  await subscriber(); const c = await campaign();
  await Enrollment.create({ campaign: c.key, email: 'parent@example.com', dueAt: new Date() });
  await Promise.all([runUpdate(c.key, { dryRun: false }), runUpdate(c.key, { dryRun: false })]);
  assert.equal(sent.length, 1);
  let e = await Enrollment.findOne(); assert.equal(e.stage, 1); assert.ok(e.dueAt - Date.now() > 1.9 * policy.DAY);
  await runUpdate(c.key, { dryRun: false }); assert.equal(sent.length, 1);
  await Enrollment.updateOne({}, { $set: { dueAt: new Date(0) } });
  await Subscriber.updateOne({}, { $set: { unsubscribedAt: new Date(), optInUpdates: false } });
  await runUpdate(c.key, { dryRun: false }); assert.equal(sent.length, 1);
  assert.equal((await Enrollment.findOne()).status, 'suppressed');
});
test('all three update stages complete, with a four-day gap after the second email', async () => {
  await subscriber(); const c = await campaign();
  await Enrollment.create({ campaign: c.key, email: 'parent@example.com', dueAt: new Date(0) });
  for (let i = 0; i < 3; i++) {
    await Enrollment.updateOne({}, { $set: { dueAt: new Date(0) } });
    await runUpdate(c.key, { dryRun: false });
    if (i === 1) assert.ok((await Enrollment.findOne()).dueAt - Date.now() > 3.9 * policy.DAY);
  }
  assert.equal(sent.length, 3); assert.equal((await Enrollment.findOne()).status, 'complete');
  await runUpdate(c.key, { dryRun: false }); assert.equal(sent.length, 3);
});
test('unsubscribe links require a valid signature; GET scanners do not unsubscribe, POST is idempotent', async () => {
  await subscriber();
  const token = policy.tokenFor('parent@example.com', process.env.EMAIL_UNSUBSCRIBE_SECRET);
  assert.equal(policy.emailFromToken(token + 'x', process.env.EMAIL_UNSUBSCRIBE_SECRET), null);
  let response = await request('/api/email-campaigns/unsubscribe?token=' + token, null, false, 'GET');
  assert.equal(response.status, 200); assert.equal((await Subscriber.findOne()).optInUpdates, true);
  response = await request('/api/email-campaigns/unsubscribe', { token }); assert.equal(response.status, 200);
  await request('/api/email-campaigns/unsubscribe', { token });
  assert.equal((await Subscriber.findOne()).optInUpdates, false);
  await request('/api/email-subscribers', { email: 'parent@example.com' });
  assert.equal((await Subscriber.findOne()).optInUpdates, false);
});
test('admin routes reject unauthenticated callers; drafts cannot launch without content or sending configuration', async () => {
  assert.equal((await request('/api/email-campaigns', { key: 'update-new' })).status, 401);
  assert.equal((await request('/api/email-campaigns', { key: 'update-new' }, true)).status, 201);
  assert.equal((await request('/api/email-campaigns/update-new/launch', {}, true)).status, 400);
  await request('/api/email-campaigns/update-new', { messages, appUrl: 'https://godlykids.app' }, true, 'PUT');
  process.env.EMAIL_CAMPAIGNS_ENABLED = 'false';
  assert.equal((await request('/api/email-campaigns/update-new/launch', {}, true)).status, 400);
  assert.equal((await Campaign.findOne()).status, 'draft'); assert.equal(sent.length, 0);
});
test('draft previews escape markup and disallow non-HTTPS links and header injection', () => {
  assert.match(render({ body: '<script>alert(1)</script>', cta: '<Open>' }, '<Parent>', 'https://godlykids.app'), /&lt;script&gt;/);
  assert.throws(() => policy.validateMessages(messages, 'javascript:alert(1)'));
  assert.throws(() => policy.validateMessages([{ ...messages[0], subject: 'Hi\nBcc: x@example.com' }, ...messages.slice(1)], 'https://godlykids.app'));
});
test('prepared website-based draft validates and uses the current app address', () => {
  const draft = require('../src/campaigns/island-update.json');
  policy.validateMessages(draft.messages, draft.appUrl);
  assert.equal(draft.appUrl, 'https://app.godlykids.com/');
  assert.equal(draft.messages.length, 3);
});
test('launch is repeatable, pause blocks sending, resume works, and batches reach later recipients', async () => {
  for (let i = 0; i < 3; i++) {
    await subscriber(`parent${i}@example.com`);
    await User.collection.insertOne({ username: `parent${i}`, email: `parent${i}@example.com`, createdAt: new Date(0) });
  }
  const payload = { key: 'update-launch', messages, appUrl: 'https://app.godlykids.com/' };
  assert.equal((await request('/api/email-campaigns', payload, true)).status, 201);
  assert.equal((await request('/api/email-campaigns/update-launch/launch', {}, true)).status, 200);
  assert.equal((await request('/api/email-campaigns/update-launch/launch', {}, true)).status, 200);
  assert.equal(await Enrollment.countDocuments(), 3);
  assert.equal(sent.length, 0);
  await runUpdate(payload.key); assert.equal(sent.length, 0);
  assert.equal((await request('/api/email-campaigns/update-launch/pause', {}, true)).status, 200);
  await assert.rejects(runUpdate(payload.key, { dryRun: false }));
  assert.equal((await request('/api/email-campaigns/update-launch/resume', {}, true)).status, 200);
  for (let i = 0; i < 3; i++) await runUpdate(payload.key, { dryRun: false, limit: 1 });
  assert.equal(sent.length, 3);
  assert.equal(new Set(sent.map(m => m.to)).size, 3);
});
