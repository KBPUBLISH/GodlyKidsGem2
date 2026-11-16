const { buildUserState } = require('../../src/services/smartNotifications/state');
const { buildCatalog } = require('../../src/services/smartNotifications/catalog');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// 2pm in New York: outside default quiet hours.
const NOW = new Date('2026-11-16T19:00:00Z');
const ago = (ms) => new Date(NOW.getTime() - ms);

const CREATION_GAMES = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ gameId: `creation-day-${d}`, name: `Creation Day ${d}`, coverImage: `day${d}.png` }));

const makeCatalog = ({ withCreation = true } = {}) => buildCatalog({
    books: [
        { _id: 'noah1', title: 'Noah Builds the Ark', categories: ['Old Testament'], files: { coverImage: 'noah1.png' }, bookGames: [{ title: 'Animal Match' }] },
        { _id: 'noah2', title: 'The Great Flood', categories: ['Old Testament'] },
        { _id: 'noah3', title: 'The Rainbow Promise', categories: ['Old Testament'], isMembersOnly: true },
        { _id: 'david', title: 'David and Goliath', categories: ['Old Testament'], isFeatured: true },
        { _id: 'jonah', title: 'Jonah and the Whale', categories: ['Old Testament'] },
        { _id: 'jesus', title: 'Jesus Feeds 5000', categories: ['New Testament'] },
    ],
    pageCounts: [{ _id: 'noah1', count: 12 }, { _id: 'david', count: 10 }, { _id: 'jonah', count: 8 }],
    series: [{ _id: 's1', title: 'Noah', books: [{ book: 'noah3', order: 3 }, { book: 'noah1', order: 1 }, { book: 'noah2', order: 2 }] }],
    games: withCreation ? CREATION_GAMES : [],
});

const makeUser = (learningProgress = {}, extra = {}) => ({
    _id: 'user1',
    deviceId: 'device-abc',
    subscriptionStatus: 'free',
    timezone: 'America/New_York',
    learningProgress,
    ...extra,
});

const makeState = (learningProgress, extra) => buildUserState(makeUser(learningProgress, extra));

module.exports = { HOUR, DAY, NOW, ago, makeCatalog, makeUser, makeState };
