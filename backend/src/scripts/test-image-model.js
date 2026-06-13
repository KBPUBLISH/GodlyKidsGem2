require('dotenv').config();
const axios = require('axios');

/**
 * Smoke test for the kids monthly book image model.
 *
 * Verifies that the configured Vertex image model (VERTEX_AI_IMAGE_MODEL,
 * default gemini-3.1-flash-image) is reachable and returns image bytes for a
 * simple text-only prompt, using the same auth + endpoint logic as
 * src/jobs/monthlyBookGenerator.js.
 *
 * Run from backend/:  node src/scripts/test-image-model.js
 * Requires: GCS_CREDENTIALS_JSON (or GOOGLE_SERVICE_ACCOUNT_JSON).
 * Optional: VERTEX_AI_IMAGE_MODEL, VERTEX_AI_IMAGE_LOCATION=global, VERTEX_AI_IMAGE_REGIONS.
 */

const VERTEX_IMAGE_MODEL = (process.env.VERTEX_AI_IMAGE_MODEL || 'gemini-3.1-flash-image').trim() || 'gemini-3.1-flash-image';

function getEndpoint() {
    const loc = (process.env.VERTEX_AI_IMAGE_LOCATION || '').trim().toLowerCase();
    if (loc === 'global') {
        return { baseUrl: 'https://aiplatform.googleapis.com/v1', location: 'global' };
    }
    const regionsStr = (process.env.VERTEX_AI_IMAGE_REGIONS || '').trim();
    const region = regionsStr ? regionsStr.split(/\s*,\s*/)[0].trim() : (loc || 'us-central1');
    return { baseUrl: `https://${region}-aiplatform.googleapis.com/v1`, location: region };
}

async function getAccessToken() {
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) throw new Error('Missing GCS_CREDENTIALS_JSON / GOOGLE_SERVICE_ACCOUNT_JSON');
    const credentials = JSON.parse(credentialsJson);
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    return { token, projectId: credentials.project_id };
}

(async () => {
    try {
        console.log('Testing Vertex image model:', VERTEX_IMAGE_MODEL);
        const { token, projectId } = await getAccessToken();
        const { baseUrl, location } = getEndpoint();
        const url = `${baseUrl}/projects/${projectId}/locations/${location}/publishers/google/models/${VERTEX_IMAGE_MODEL}:generateContent`;
        console.log('Project:', projectId, '| Location:', location);
        console.log('POST', url);

        const started = Date.now();
        const res = await axios.post(
            url,
            {
                contents: [{
                    role: 'user',
                    parts: [{ text: "Generate one image: a friendly cartoon lamb in a sunny green meadow, children's book illustration style, warm colors, no text. Vertical 9:16 composition." }],
                }],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig: { aspectRatio: '9:16' },
                },
            },
            {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                timeout: 60000,
                validateStatus: () => true,
            }
        );

        const ms = Date.now() - started;
        console.log('HTTP', res.status, `(${ms}ms)`);
        if (res.status !== 200) {
            console.error('FAILED:', typeof res.data === 'string' ? res.data.slice(0, 500) : JSON.stringify(res.data).slice(0, 500));
            process.exit(1);
        }
        const parts = res.data.candidates?.[0]?.content?.parts || [];
        const img = parts.find((p) => p.inlineData && p.inlineData.data);
        if (img) {
            const bytes = Buffer.from(img.inlineData.data, 'base64').length;
            console.log('PASS: received image,', bytes, 'bytes, mime:', img.inlineData.mimeType || '(unknown)');
        } else {
            console.warn('WARN: 200 OK but no image part returned. Parts:', JSON.stringify(parts).slice(0, 300));
            process.exit(2);
        }
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
})();
