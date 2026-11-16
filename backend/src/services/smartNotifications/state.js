/**
 * User progress: sanitising client reports, merging them into AppUser.learningProgress,
 * and turning the stored document into the shape the rules read.
 */

const MAX_ID_LENGTH = 64;
const MAX_COMPLETED = 500;
const MAX_IN_PROGRESS = 20;
const MAX_BUILDINGS = 100;

const PREMIUM_STATUSES = new Set(['active', 'trial', 'reverse_trial']);

const cleanId = (value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const id = String(value).trim();
    return id && id.length <= MAX_ID_LENGTH ? id : null;
};

/** Client clocks can't be trusted to be in the past; clamp to `now` and drop garbage. */
const cleanDate = (value, now) => {
    if (value === undefined || value === null) return now;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date > now ? now : date;
};

const cleanCount = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 1e6) : undefined;
};

/** Validate a client progress report. Unknown fields are dropped. */
const sanitizeProgressReport = (body = {}, now = new Date()) => {
    const report = { completedBooks: [], inProgressBooks: [], completedGames: [], island: null };

    for (const entry of Array.isArray(body.completedBooks) ? body.completedBooks : []) {
        const bookId = cleanId(entry?.bookId ?? entry);
        const completedAt = cleanDate(entry?.completedAt, now);
        if (bookId && completedAt) report.completedBooks.push({ bookId, completedAt });
    }

    for (const entry of Array.isArray(body.inProgressBooks) ? body.inProgressBooks : []) {
        const bookId = cleanId(entry?.bookId);
        const lastReadAt = cleanDate(entry?.lastReadAt, now);
        const pageIndex = cleanCount(entry?.pageIndex);
        if (bookId && lastReadAt && pageIndex !== undefined) report.inProgressBooks.push({ bookId, pageIndex, lastReadAt });
    }

    for (const entry of Array.isArray(body.completedGames) ? body.completedGames : []) {
        const gameId = cleanId(entry?.gameId ?? entry);
        const completedAt = cleanDate(entry?.completedAt, now);
        if (gameId && completedAt) report.completedGames.push({ gameId, completedAt });
    }

    if (body.island && typeof body.island === 'object') {
        const buildings = (Array.isArray(body.island.buildings) ? body.island.buildings : [])
            .map(cleanId)
            .filter(Boolean)
            .slice(0, MAX_BUILDINGS);
        report.island = {
            buildings,
            harvestCount: cleanCount(body.island.harvestCount),
            cookedRecipeCount: cleanCount(body.island.cookedRecipeCount),
        };
    }

    return report;
};

/** Union by key, keeping the earliest timestamp (first completion is what counts). */
const unionEarliest = (existing, incoming, key, dateField) => {
    const byKey = new Map();
    for (const item of [...existing, ...incoming]) {
        const prev = byKey.get(item[key]);
        if (!prev || new Date(item[dateField]) < new Date(prev[dateField])) {
            byKey.set(item[key], { [key]: item[key], [dateField]: new Date(item[dateField]) });
        }
    }
    return [...byKey.values()]
        .sort((a, b) => b[dateField] - a[dateField])
        .slice(0, MAX_COMPLETED);
};

/** Merge a sanitised report into stored learningProgress, returning a new plain object. */
const mergeProgress = (existing = {}, report, now = new Date()) => {
    const completedBooks = unionEarliest(existing.completedBooks || [], report.completedBooks, 'bookId', 'completedAt');
    const completedIds = new Set(completedBooks.map((b) => b.bookId));

    const inProgress = new Map();
    for (const item of [...(existing.inProgressBooks || []), ...report.inProgressBooks]) {
        const prev = inProgress.get(item.bookId);
        if (!prev || new Date(item.lastReadAt) >= new Date(prev.lastReadAt)) {
            inProgress.set(item.bookId, {
                bookId: item.bookId,
                pageIndex: item.pageIndex,
                lastReadAt: new Date(item.lastReadAt),
            });
        }
    }
    const inProgressBooks = [...inProgress.values()]
        .filter((p) => !completedIds.has(p.bookId))
        .sort((a, b) => b.lastReadAt - a.lastReadAt)
        .slice(0, MAX_IN_PROGRESS);

    const completedGames = unionEarliest(existing.completedGames || [], report.completedGames, 'gameId', 'completedAt');

    const previousIsland = existing.island || {};
    let island = existing.island;
    if (report.island) {
        island = {
            buildings: [...new Set([...(previousIsland.buildings || []), ...report.island.buildings])].slice(0, MAX_BUILDINGS),
            harvestCount: Math.max(previousIsland.harvestCount || 0, report.island.harvestCount || 0),
            cookedRecipeCount: Math.max(previousIsland.cookedRecipeCount || 0, report.island.cookedRecipeCount || 0),
            updatedAt: now,
        };
    }

    return { completedBooks, inProgressBooks, completedGames, island, updatedAt: now };
};

/** Shape AppUser into what the rules read. */
const buildUserState = (user) => {
    const progress = user.learningProgress || {};
    const completedBooks = [...(progress.completedBooks || [])]
        .map((b) => ({ bookId: String(b.bookId), completedAt: new Date(b.completedAt) }))
        .sort((a, b) => b.completedAt - a.completedAt);
    const island = progress.island && (progress.island.buildings || []).length > 0
        ? {
            buildings: new Set(progress.island.buildings),
            harvestCount: progress.island.harvestCount || 0,
            cookedRecipeCount: progress.island.cookedRecipeCount || 0,
            updatedAt: progress.island.updatedAt ? new Date(progress.island.updatedAt) : null,
        }
        : null;

    return {
        userKey: String(user._id),
        isPremium: PREMIUM_STATUSES.has(user.subscriptionStatus),
        timezone: user.timezone || 'America/New_York',
        completedBooks,
        completedBookIds: new Set(completedBooks.map((b) => b.bookId)),
        inProgressBooks: (progress.inProgressBooks || []).map((p) => ({
            bookId: String(p.bookId),
            pageIndex: p.pageIndex || 0,
            lastReadAt: new Date(p.lastReadAt),
        })),
        completedGames: new Map((progress.completedGames || []).map((g) => [String(g.gameId), new Date(g.completedAt)])),
        island,
    };
};

module.exports = { sanitizeProgressReport, mergeProgress, buildUserState };
