const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { authenticateAdmin } = require('../middleware/auth');

// Map friendly tiers to Claude model IDs.
// Overridable via env in case Anthropic ships new model IDs.
const MODEL_TIERS = {
    opus: process.env.ANTHROPIC_MODEL_OPUS || 'claude-opus-5',
    sonnet: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-5',
};

const MAX_ARRAY_ITEMS = 40; // Keep prompt cost predictable by trimming long lists

/**
 * Recursively trims large arrays in the analytics payload so we never send an
 * unbounded amount of data to the model. Objects/arrays are copied, not mutated.
 */
function trimPayload(value, depth = 0) {
    if (Array.isArray(value)) {
        const trimmed = value.slice(0, MAX_ARRAY_ITEMS).map((v) => trimPayload(v, depth + 1));
        if (value.length > MAX_ARRAY_ITEMS) {
            trimmed.push(`…(${value.length - MAX_ARRAY_ITEMS} more items omitted)`);
        }
        return trimmed;
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = trimPayload(v, depth + 1);
        }
        return out;
    }
    return value;
}

const SYSTEM_PROMPT = `You are a senior product analyst and growth advisor for "Godly Kids", a faith-based children's reading and audio mobile app. You are reviewing aggregated, anonymized analytics from the app's admin portal (no child personal data is included).

Your job: diagnose what the data shows and give the team clear, prioritized, actionable recommendations. Be concrete and specific — reference the actual metrics and content titles in the data. Prefer a few high-impact recommendations over many shallow ones. Consider engagement, retention, onboarding funnel drop-off, paywall/conversion, and content performance. Remember this is an Apple Kids Category app, so recommendations must respect child-safety and privacy constraints (no behavioral ad tracking of kids).

You MUST respond with ONLY a single valid JSON object (no markdown, no code fences, no prose before or after) matching exactly this schema:
{
  "diagnosis": "string — a concise 2-4 sentence overall read of how things are going",
  "findings": [
    {
      "title": "string — short finding headline",
      "detail": "string — 1-3 sentences explaining the finding, citing specific numbers/titles",
      "severity": "critical" | "warning" | "positive" | "info"
    }
  ],
  "recommendations": [
    {
      "title": "string — short imperative action",
      "detail": "string — what to do and why, referencing the data",
      "priority": "high" | "medium" | "low",
      "expectedImpact": "string — the metric you'd expect to move"
    }
  ]
}
Return 3-6 findings and 3-6 recommendations, ordered most important first. If the data is too sparse to draw a conclusion, say so in the diagnosis and note what to track.`;

function extractJson(text) {
    if (!text) return null;
    let cleaned = text.trim();
    // Strip markdown code fences if the model added them despite instructions
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
    }
    try {
        return JSON.parse(cleaned);
    } catch (_) {
        // Fall back to first {...} block
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            try {
                return JSON.parse(cleaned.slice(start, end + 1));
            } catch (_) {
                return null;
            }
        }
        return null;
    }
}

/**
 * POST /api/ai/insights
 * Body: { tier?: 'opus'|'sonnet', focus?: string, timeRange?: string, summary: object }
 * Returns: { diagnosis, findings[], recommendations[], model, tier, generatedAt }
 */
router.post('/insights', authenticateAdmin, async (req, res) => {
    try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return res.status(503).json({
                error: 'AI insights not configured',
                message: 'ANTHROPIC_API_KEY is not set on the server.',
            });
        }

        const { tier = 'sonnet', focus = '', timeRange = 'all', summary } = req.body || {};

        if (!summary || typeof summary !== 'object') {
            return res.status(400).json({ error: 'Missing analytics "summary" object in request body.' });
        }

        const model = MODEL_TIERS[tier] || MODEL_TIERS.sonnet;
        const trimmed = trimPayload(summary);

        const focusLine = focus && focus.trim()
            ? `The team specifically wants you to focus on: ${focus.trim()}\n\n`
            : '';

        const userContent = `${focusLine}Time range for this data: ${timeRange}.

Here is the aggregated analytics data (JSON):

${JSON.stringify(trimmed, null, 2)}`;

        const anthropic = new Anthropic({ apiKey });

        const message = await anthropic.messages.create({
            model,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userContent }],
        });

        const rawText = (message.content || [])
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
            .trim();

        const parsed = extractJson(rawText);

        if (!parsed) {
            // Return the raw text so the UI can still show something useful
            return res.json({
                diagnosis: rawText || 'The model did not return a usable response.',
                findings: [],
                recommendations: [],
                model,
                tier,
                generatedAt: new Date().toISOString(),
                unstructured: true,
            });
        }

        return res.json({
            diagnosis: parsed.diagnosis || '',
            findings: Array.isArray(parsed.findings) ? parsed.findings : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            model,
            tier,
            generatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('❌ AI insights error:', error?.message || error);
        const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
        return res.status(status >= 400 && status < 600 ? status : 500).json({
            error: 'Failed to generate insights',
            message: error?.message || 'Unknown error',
        });
    }
});

// GET /api/ai/insights/status - lightweight check for whether the feature is configured
router.get('/insights/status', authenticateAdmin, (req, res) => {
    res.json({
        configured: !!process.env.ANTHROPIC_API_KEY,
        models: MODEL_TIERS,
    });
});

module.exports = router;
