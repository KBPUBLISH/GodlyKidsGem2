/**
 * Sends a selected notification exactly once.
 *
 * Two claims are inserted before sending, both protected by NotificationLog's unique index:
 *  - `slot:<UTC date>` caps smart sends at one per user per day even if job runs overlap;
 *  - the candidate's dedupeKey guarantees the same message never goes out twice.
 * If the push provider fails, both claims are released so the message can be retried later.
 */

const SLOT_PREFIX = 'slot:';

const isDuplicateKeyError = (error) => error && (error.code === 11000 || error.code === 11001);

const createMongoLogStore = (NotificationLog) => ({
    async claim(doc) {
        try {
            await NotificationLog.create({ ...doc, status: 'pending' });
            return true;
        } catch (error) {
            if (isDuplicateKeyError(error)) return false;
            throw error;
        }
    },
    async release(userKey, dedupeKeys) {
        await NotificationLog.deleteMany({ userKey, dedupeKey: { $in: dedupeKeys }, status: 'pending' });
    },
    async markSent(userKey, dedupeKeys) {
        await NotificationLog.updateMany({ userKey, dedupeKey: { $in: dedupeKeys } }, { $set: { status: 'sent' } });
    },
    async history(userKey) {
        return NotificationLog.find({ userKey, dedupeKey: { $not: /^slot:/ } })
            .select('dedupeKey category ruleId sentAt')
            .lean();
    },
});

/** OneSignal target: the native/web SDKs register the same id the app sends to the backend (email or deviceId). */
const externalUserId = (user) => user.email || user.deviceId || String(user._id);

const createOneSignalSender = (notificationService) => async (user, notification) => {
    const payload = {
        title: notification.title,
        message: notification.message,
        url: notification.url,
        imageUrl: notification.imageUrl || undefined,
        data: { type: 'smart', ruleId: notification.ruleId, dedupeKey: notification.dedupeKey, ...notification.data },
    };
    const result = user.oneSignalPlayerId
        ? await notificationService.sendNotificationByPlayerId({ playerId: user.oneSignalPlayerId, ...payload })
        : await notificationService.sendNotificationToUser({ userId: externalUserId(user), ...payload });
    return !!result;
};

const createDispatcher = ({ logStore, send }) => ({
    async dispatch({ user, notification, now = new Date() }) {
        const userKey = String(user._id);
        const slotKey = `${SLOT_PREFIX}${now.toISOString().slice(0, 10)}`;
        const base = { userKey, sentAt: now };

        if (!(await logStore.claim({ ...base, dedupeKey: slotKey, ruleId: 'slot', category: 'slot' }))) {
            return { sent: false, reason: 'daily_slot_taken' };
        }
        const claimed = await logStore.claim({
            ...base,
            dedupeKey: notification.dedupeKey,
            ruleId: notification.ruleId,
            category: notification.category,
            title: notification.title,
        });
        if (!claimed) {
            await logStore.release(userKey, [slotKey]);
            return { sent: false, reason: 'duplicate' };
        }

        let ok = false;
        try {
            ok = await send(user, notification);
        } catch (error) {
            console.error(`❌ Smart notification send failed for ${userKey}:`, error.message);
        }
        if (!ok) {
            await logStore.release(userKey, [slotKey, notification.dedupeKey]);
            return { sent: false, reason: 'send_failed' };
        }
        await logStore.markSent(userKey, [slotKey, notification.dedupeKey]);
        return { sent: true, reason: 'sent' };
    },
});

module.exports = { createDispatcher, createMongoLogStore, createOneSignalSender, externalUserId };
