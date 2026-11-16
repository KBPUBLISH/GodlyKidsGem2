/**
 * Notification rules. Each rule looks at a user's state (see state.js) plus the content catalog
 * and returns zero or more candidates. Rules are pure: no I/O, `now` is passed in.
 *
 * A candidate's `dedupeKey` identifies the message for "never send twice" purposes, so it must
 * be stable for the same piece of news (e.g. one key per unlocked game, not per evaluation).
 */

const { PROGRESSION_TRACKS } = require('./progressionTracks');
const { ISLAND_TIPS } = require('./islandTips');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ageMs = (date, now) => now.getTime() - new Date(date).getTime();

const bookUrl = (bookId) => `/#/book/${bookId}`;

const canRead = (book, state) => book && (!book.isMembersOnly || state.isPremium);

const isStartedOrDone = (state, bookId) =>
    state.completedBookIds.has(bookId) || state.inProgressBooks.some((p) => p.bookId === bookId);

const trackUnlockRule = {
    id: 'track_unlock',
    category: 'game_unlock',
    priority: 100,
    evaluate(state, catalog, now, tracks = PROGRESSION_TRACKS) {
        const candidates = [];
        for (const track of tracks) {
            if (!track.steps.every((s) => catalog.gamesById.has(s.gameId))) continue;

            const nextIndex = track.steps.findIndex((s) => !state.completedGames.has(s.gameId));
            if (nextIndex <= 0) continue; // track not started, or finished

            const previousDoneAt = state.completedGames.get(track.steps[nextIndex - 1].gameId);
            const sincePrevious = ageMs(previousDoneAt, now);
            if (sincePrevious < track.unlockAfterHours * HOUR) continue;
            if (sincePrevious > track.staleAfterDays * DAY) continue;

            const step = track.steps[nextIndex];
            const game = catalog.gamesById.get(step.gameId);
            candidates.push({
                dedupeKey: `track:${track.id}:${step.day}`,
                title: `🎮 New game unlocked: Day ${step.day} of ${track.name}!`,
                message: `${step.theme}. Come play Day ${step.day} and see what happens next!`,
                url: track.url,
                imageUrl: game.coverImage || null,
                data: { trackId: track.id, day: step.day, gameId: step.gameId },
            });
        }
        return candidates;
    },
};

const trackStartRule = {
    id: 'track_start',
    category: 'game_unlock',
    priority: 30,
    evaluate(state, catalog, now, tracks = PROGRESSION_TRACKS) {
        if (state.completedBookIds.size === 0) return [];
        const candidates = [];
        for (const track of tracks) {
            const first = track.steps[0];
            if (!track.steps.every((s) => catalog.gamesById.has(s.gameId))) continue;
            if (track.steps.some((s) => state.completedGames.has(s.gameId))) continue;
            const game = catalog.gamesById.get(first.gameId);
            candidates.push({
                dedupeKey: `track_start:${track.id}`,
                title: `🌍 ${track.name} is here!`,
                message: `Play Day 1: ${first.theme}. A new game unlocks each day!`,
                url: track.url,
                imageUrl: game.coverImage || null,
                data: { trackId: track.id, day: first.day, gameId: first.gameId },
            });
        }
        return candidates;
    },
};

/** Finishing a book unlocks its bonus games; remind the child they're waiting. */
const bookGamesUnlockedRule = {
    id: 'book_games_unlocked',
    category: 'game_unlock',
    priority: 90,
    evaluate(state, catalog, now) {
        const candidates = [];
        for (const { bookId, completedAt } of state.completedBooks) {
            const age = ageMs(completedAt, now);
            if (age > 7 * DAY) break; // completedBooks is newest first
            if (age < 2 * HOUR) continue; // they just saw the unlock in the app
            const book = catalog.booksById.get(bookId);
            if (!book || book.bookGames.length === 0) continue;
            const game = book.bookGames[0];
            const more = book.bookGames.length > 1 ? ` and ${book.bookGames.length - 1} more` : '';
            candidates.push({
                dedupeKey: `book_games:${bookId}`,
                title: `🎮 New game unlocked: ${game.title}!`,
                message: `Finishing "${book.title}" unlocked ${game.title}${more}. Come play!`,
                url: bookUrl(bookId),
                imageUrl: game.coverImage || book.coverImage || null,
                data: { bookId },
            });
        }
        return candidates;
    },
};

const continueReadingRule = {
    id: 'continue_reading',
    category: 'reading',
    priority: 80,
    evaluate(state, catalog, now) {
        const candidates = [];
        const recent = [...state.inProgressBooks].sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt));
        for (const progress of recent) {
            if (state.completedBookIds.has(progress.bookId)) continue;
            const age = ageMs(progress.lastReadAt, now);
            if (age < 20 * HOUR || age > 10 * DAY) continue;
            const book = catalog.booksById.get(progress.bookId);
            if (!canRead(book, state) || !book.pageCount) continue;
            const page = progress.pageIndex + 1;
            const left = book.pageCount - page;
            if (progress.pageIndex < 1 || left < 1) continue;
            candidates.push({
                dedupeKey: `continue:${book.id}`,
                title: `📖 Finish "${book.title}"`,
                message: `You're on page ${page} of ${book.pageCount}. Only ${left} ${left === 1 ? 'page' : 'pages'} to go!`,
                url: bookUrl(book.id),
                imageUrl: book.coverImage || null,
                data: { bookId: book.id },
            });
        }
        return candidates;
    },
};

const nextInSeriesRule = {
    id: 'next_in_series',
    category: 'reading',
    priority: 70,
    evaluate(state, catalog) {
        const candidates = [];
        const seen = new Set();
        for (const { bookId } of state.completedBooks) {
            const finished = catalog.booksById.get(bookId);
            for (const series of catalog.seriesByBookId.get(bookId) || []) {
                const position = series.bookIds.indexOf(bookId);
                const nextId = series.bookIds
                    .slice(position + 1)
                    .find((id) => !isStartedOrDone(state, id) && canRead(catalog.booksById.get(id), state));
                if (!nextId || seen.has(nextId)) continue;
                seen.add(nextId);
                const next = catalog.booksById.get(nextId);
                candidates.push({
                    dedupeKey: `next:${nextId}`,
                    title: `📚 Next story: "${next.title}"`,
                    message: finished
                        ? `You finished "${finished.title}". Ready for the next ${series.title} adventure?`
                        : `Your next ${series.title} adventure is ready!`,
                    url: bookUrl(nextId),
                    imageUrl: next.coverImage || null,
                    data: { bookId: nextId, seriesId: series.id },
                });
            }
        }
        return candidates;
    },
};

/** Fallback when there's no series: another story from the same category as the last finished book. */
const recommendBookRule = {
    id: 'recommend_book',
    category: 'reading',
    priority: 40,
    evaluate(state, catalog) {
        const last = state.completedBooks[0] && catalog.booksById.get(state.completedBooks[0].bookId);
        if (!last || last.categories.length === 0) return [];
        const categories = new Set(last.categories);
        const picks = [...catalog.booksById.values()]
            .filter((b) => b.id !== last.id && b.categories.some((c) => categories.has(c)))
            .filter((b) => !isStartedOrDone(state, b.id) && canRead(b, state))
            .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured))
            .slice(0, 3);
        return picks.map((book) => ({
            dedupeKey: `recommend:${book.id}`,
            title: `✨ A story picked for you`,
            message: `Loved "${last.title}"? Try "${book.title}" next!`,
            url: bookUrl(book.id),
            imageUrl: book.coverImage || null,
            data: { bookId: book.id },
        }));
    },
};

const islandTipRule = {
    id: 'island_tip',
    category: 'island',
    priority: 50,
    evaluate(state, catalog, now, tips = ISLAND_TIPS) {
        const island = state.island;
        if (!island || island.buildings.size === 0) return [];
        if (!island.updatedAt || ageMs(island.updatedAt, now) > 30 * DAY) return [];
        return tips
            .filter((tip) => tip.applies(island))
            .map((tip) => ({
                dedupeKey: `island_tip:${tip.id}`,
                title: tip.title,
                message: tip.message,
                url: '/#/home',
                data: { tipId: tip.id },
            }));
    },
};

const RULES = [
    trackUnlockRule,
    bookGamesUnlockedRule,
    continueReadingRule,
    nextInSeriesRule,
    islandTipRule,
    recommendBookRule,
    trackStartRule,
];

module.exports = { RULES };
