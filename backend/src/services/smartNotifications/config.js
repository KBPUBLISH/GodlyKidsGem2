/**
 * Smart (behaviour-based) notification settings.
 * Every value can be overridden with an environment variable so ops can tune caps without a deploy.
 */

const num = (name, fallback) => {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getConfig = () => ({
    enabled: process.env.SMART_NOTIFICATIONS_ENABLED !== 'false',
    // Never send two smart notifications closer together than this.
    minHoursBetween: num('SMART_NOTIFICATIONS_MIN_HOURS_BETWEEN', 20),
    maxPerWeek: num('SMART_NOTIFICATIONS_MAX_PER_WEEK', 4),
    // Suppress smart notifications during the user's local night (start inclusive, end exclusive).
    quietHoursStart: num('SMART_NOTIFICATIONS_QUIET_START', 20),
    quietHoursEnd: num('SMART_NOTIFICATIONS_QUIET_END', 8),
    categoryCooldownHours: {
        game_unlock: num('SMART_NOTIFICATIONS_COOLDOWN_GAME_UNLOCK', 20),
        reading: num('SMART_NOTIFICATIONS_COOLDOWN_READING', 72),
        island: num('SMART_NOTIFICATIONS_COOLDOWN_ISLAND', 96),
    },
});

module.exports = { getConfig };
