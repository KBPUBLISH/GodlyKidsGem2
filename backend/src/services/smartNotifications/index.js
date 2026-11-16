/**
 * Behaviour-based push notifications.
 *
 *   state.js      user progress -> rule input
 *   rules.js      triggers (next story, game unlocks, island tips, ...)
 *   engine.js     picks one candidate under frequency caps + dedupe
 *   dispatcher.js claims + sends exactly once
 */

const { getConfig } = require('./config');
const { buildUserState, sanitizeProgressReport, mergeProgress } = require('./state');
const { selectNotification } = require('./engine');
const { createDispatcher, createMongoLogStore, createOneSignalSender } = require('./dispatcher');

const createSmartNotifier = ({ catalog, logStore, send, config = getConfig() }) => {
    const dispatcher = createDispatcher({ logStore, send });

    const decide = async (user, now) => {
        const state = buildUserState(user);
        const history = await logStore.history(state.userKey);
        return selectNotification({ state, catalog, history, now, config });
    };

    return {
        /** Dry run: what would this user get right now, and why. */
        preview: (user, now = new Date()) => decide(user, now),

        async notifyUser(user, now = new Date()) {
            if (user.smartNotificationsDisabled) return { sent: false, reason: 'opted_out' };
            const decision = await decide(user, now);
            if (!decision.notification) return { sent: false, reason: decision.reason };
            const result = await dispatcher.dispatch({ user, notification: decision.notification, now });
            return { ...result, notification: decision.notification };
        },
    };
};

/** Production wiring: Mongo log + OneSignal. Catalog is loaded once per call. */
const createDefaultSmartNotifier = async () => {
    const { loadCatalog } = require('./catalog');
    const NotificationLog = require('../../models/NotificationLog');
    const notificationService = require('../notificationService');
    return createSmartNotifier({
        catalog: await loadCatalog(),
        logStore: createMongoLogStore(NotificationLog),
        send: createOneSignalSender(notificationService),
    });
};

/** Fields the notifier needs when selecting AppUser documents. */
const SMART_USER_FIELDS = 'learningProgress smartNotificationsDisabled subscriptionStatus timezone email deviceId oneSignalPlayerId';

module.exports = {
    getConfig,
    createSmartNotifier,
    createDefaultSmartNotifier,
    sanitizeProgressReport,
    mergeProgress,
    SMART_USER_FIELDS,
};
