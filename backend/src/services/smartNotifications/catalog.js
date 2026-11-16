/**
 * Loads the published content the rules reason about. Loaded once per job run, shared by all users.
 */

const Book = require('../../models/Book');
const BookSeries = require('../../models/BookSeries');
const Game = require('../../models/Game');
const Page = require('../../models/Page');

const buildCatalog = ({ books = [], pageCounts = [], series = [], games = [] }) => {
    const counts = new Map(pageCounts.map((p) => [String(p._id), p.count]));

    const booksById = new Map();
    for (const b of books) {
        const id = String(b._id);
        booksById.set(id, {
            id,
            title: b.title,
            categories: [...new Set([...(b.categories || []), b.category].filter((c) => c && c !== 'Other'))],
            isMembersOnly: !!b.isMembersOnly,
            isFeatured: !!b.isFeatured,
            coverImage: b.files?.coverImage || b.coverImage || null,
            pageCount: counts.get(id) || 0,
            bookGames: (b.bookGames || []).map((g) => ({ title: g.title, coverImage: g.coverImage || null })),
        });
    }

    const seriesByBookId = new Map();
    for (const s of series) {
        const bookIds = [...(s.books || [])]
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((entry) => String(entry.book))
            .filter((id) => booksById.has(id));
        const entry = { id: String(s._id), title: s.title, bookIds };
        for (const id of bookIds) {
            if (!seriesByBookId.has(id)) seriesByBookId.set(id, []);
            seriesByBookId.get(id).push(entry);
        }
    }

    const gamesById = new Map(games.map((g) => [g.gameId, { gameId: g.gameId, name: g.name, coverImage: g.coverImage || g.logo || null }]));

    return { booksById, seriesByBookId, gamesById };
};

const loadCatalog = async () => {
    const [books, pageCounts, series, games] = await Promise.all([
        Book.find({ status: 'published', bookType: { $ne: 'kids_monthly' } })
            .select('title category categories isMembersOnly isFeatured files.coverImage coverImage bookGames.title bookGames.coverImage')
            .lean(),
        Page.aggregate([{ $group: { _id: '$bookId', count: { $sum: 1 } } }]),
        BookSeries.find({ status: 'published' }).select('title books').lean(),
        Game.find({ enabled: true }).select('gameId name coverImage logo').lean(),
    ]);
    return buildCatalog({ books, pageCounts, series, games });
};

module.exports = { loadCatalog, buildCatalog };
