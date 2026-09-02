/**
 * Helpers for Godly Hub series that are still being written.
 *
 * A series with `planned` episodes is "in progress": families can buy it now
 * as a pledge, getting the released episodes today and the planned ones free
 * as the creator ships them. These functions are pure so the rules can be
 * tested without a database.
 */

/**
 * Normalize an episode list coming from the creator portal.
 * Planned episodes are announcements: no audio, but they need a release date
 * so the app can show "Coming Oct 2026". `reviewStatus` is never trusted from
 * the client — the caller decides it.
 */
function sanitizeItems(items, { reviewStatus } = {}) {
    return (items || []).map((item, index) => {
        const planned = Boolean(item.planned);
        return {
            ...(item._id ? { _id: item._id } : {}),
            title: item.title,
            description: item.description,
            coverImage: item.coverImage,
            audioUrl: planned ? undefined : item.audioUrl,
            duration: planned ? undefined : item.duration,
            order: item.order !== undefined ? item.order : index,
            planned,
            releaseDate: planned && item.releaseDate ? new Date(item.releaseDate) : undefined,
            reviewStatus: reviewStatus || item.reviewStatus || 'approved',
        };
    });
}

/** Returns an error message for an inconsistent episode list, or null. */
function validateItems(items) {
    for (const [index, item] of (items || []).entries()) {
        if (!item.title) {
            return `Episode ${index + 1} needs a title`;
        }
        if (item.planned && !item.releaseDate) {
            return `"${item.title}" is marked coming soon, so it needs a release month`;
        }
        if (!item.planned && !item.audioUrl) {
            return `"${item.title}" needs an audio file, or mark it coming soon`;
        }
    }
    return null;
}

/**
 * Shape a playlist for the app: episodes awaiting review (or rejected) are
 * hidden, and backer count is spelled out so clients don't have to know that
 * buying an unfinished series is a pledge.
 */
function toPublicPlaylist(playlist) {
    const items = (playlist.items || []).filter(
        (item) => (item.reviewStatus || 'approved') === 'approved'
    );
    return {
        ...playlist,
        items,
        backerCount: playlist.purchaseCount || 0,
    };
}

const isLive = (item) =>
    !item.planned && (item.reviewStatus || 'approved') === 'approved';

/**
 * Merge a creator's episode edits into a PUBLISHED series.
 *
 * Rules, in order of importance:
 *  - Episodes that are already live are frozen: they can't be removed or
 *    altered, because families own them and may be mid-listen.
 *  - Planned episodes can be added, re-scheduled, retitled, or dropped.
 *  - Releasing a planned episode (giving it audio) sends it to review, so a
 *    published series can't be used to slip unreviewed audio to kids.
 *
 * @returns {{ error: string } | { items: Array, newlyReleased: number }}
 */
function mergeEpisodeUpdate(existingItems, incomingItems) {
    const existingById = new Map(
        (existingItems || []).map((item) => [String(item._id), item])
    );
    const keptIds = new Set(
        incomingItems.filter((item) => item._id).map((item) => String(item._id))
    );

    const droppedLive = (existingItems || []).find(
        (item) => isLive(item) && !keptIds.has(String(item._id))
    );
    if (droppedLive) {
        return { error: `"${droppedLive.title}" is already live and cannot be removed` };
    }

    let newlyReleased = 0;
    const items = incomingItems.map((item) => {
        const existing = item._id ? existingById.get(String(item._id)) : null;

        // Live episodes pass through untouched.
        if (existing && isLive(existing)) {
            return existing;
        }

        const wasPlanned = existing ? existing.planned : true;
        const isReleasingNow = !item.planned && Boolean(item.audioUrl);

        if (isReleasingNow && (wasPlanned || !existing)) {
            newlyReleased += 1;
            return { ...item, reviewStatus: 'pending' };
        }

        // Still planned, or an already-pending/rejected episode being edited.
        return {
            ...item,
            reviewStatus: item.planned ? 'approved' : (existing?.reviewStatus || 'pending'),
        };
    });

    return { items, newlyReleased };
}

module.exports = {
    sanitizeItems,
    validateItems,
    toPublicPlaylist,
    mergeEpisodeUpdate,
};
