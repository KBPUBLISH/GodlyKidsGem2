/**
 * Picks at most one notification for a user, applying frequency caps and dedupe.
 * Pure: takes the user's send history in, returns a decision; sending happens in dispatcher.js.
 */

const { RULES } = require('./rules');

const HOUR = 60 * 60 * 1000;

const localHour = (timezone, now) => {
    try {
        const hour = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(now);
        return parseInt(hour, 10);
    } catch {
        return null;
    }
};

const inQuietHours = (hour, start, end) => {
    if (hour === null || start === end) return false;
    return start > end ? hour >= start || hour < end : hour >= start && hour < end;
};

/**
 * @param {object} args
 * @param {object} args.state     from buildUserState()
 * @param {object} args.catalog   from loadCatalog()
 * @param {Array<{dedupeKey:string, category:string, sentAt:Date}>} args.history  this user's smart sends
 * @param {Date}   args.now
 * @param {object} args.config    from getConfig()
 * @returns {{ notification: object|null, reason: string, candidates: object[] }}
 */
const selectNotification = ({ state, catalog, history = [], now = new Date(), config, rules = RULES }) => {
    const none = (reason, candidates = []) => ({ notification: null, reason, candidates });

    if (!config.enabled) return none('disabled');
    if (inQuietHours(localHour(state.timezone, now), config.quietHoursStart, config.quietHoursEnd)) {
        return none('quiet_hours');
    }

    const sentAt = (h) => new Date(h.sentAt).getTime();
    const lastSend = Math.max(0, ...history.map(sentAt));
    if (now.getTime() - lastSend < config.minHoursBetween * HOUR) return none('min_gap');

    const weekAgo = now.getTime() - 7 * 24 * HOUR;
    if (history.filter((h) => sentAt(h) >= weekAgo).length >= config.maxPerWeek) return none('weekly_cap');

    const sentKeys = new Set(history.map((h) => h.dedupeKey));
    const coolingCategories = new Set(
        history
            .filter((h) => now.getTime() - sentAt(h) < (config.categoryCooldownHours[h.category] || 0) * HOUR)
            .map((h) => h.category),
    );

    const candidates = [];
    for (const rule of [...rules].sort((a, b) => b.priority - a.priority)) {
        if (coolingCategories.has(rule.category)) continue;
        for (const candidate of rule.evaluate(state, catalog, now)) {
            if (sentKeys.has(candidate.dedupeKey)) continue;
            candidates.push({ ...candidate, ruleId: rule.id, category: rule.category, priority: rule.priority });
        }
    }

    if (candidates.length === 0) return none('no_candidates');
    return { notification: candidates[0], reason: 'selected', candidates };
};

module.exports = { selectNotification, localHour, inQuietHours };
