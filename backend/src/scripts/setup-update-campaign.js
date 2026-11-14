require('dotenv').config();
const draft = require('../campaigns/island-update.json');
const { validateMessages } = require('../services/campaignPolicy');
async function main() {
  validateMessages(draft.messages, draft.appUrl);
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ status: 'preview_only', draft }, null, 2));
    return;
  }
  const base = new URL(process.env.PUBLIC_API_URL);
  if (base.protocol !== 'https:' || !process.env.ADMIN_API_KEY) throw new Error('Set PUBLIC_API_URL and ADMIN_API_KEY');
  const response = await fetch(base.origin + '/api/email-campaigns', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': process.env.ADMIN_API_KEY },
    body: JSON.stringify(draft),
  });
  if (!response.ok) throw new Error('Draft creation failed: HTTP ' + response.status);
  const campaign = await response.json();
  console.log(JSON.stringify({ key: campaign.key, status: campaign.status, audienceCutoff: campaign.audienceCutoff }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
