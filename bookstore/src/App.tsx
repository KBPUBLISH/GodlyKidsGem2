import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PlayCircle,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import type { AmazonBook, Review } from './services/api';
import { fetchPublishedBooks, trackBookClick } from './services/api';

const ALL_CATEGORY = 'All Books';

function App() {
  const [books, setBooks] = useState<AmazonBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);
  const [selected, setSelected] = useState<AmazonBook | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPublishedBooks();
        if (cancelled) return;
        setBooks(data);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load books');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lock body scroll while modal is open + close on ESC
  useEffect(() => {
    if (!selected) return;
    document.body.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [selected]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const b of books) {
      if (b.category) set.add(b.category);
      for (const c of b.categories ?? []) set.add(c);
    }
    return [ALL_CATEGORY, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [books]);

  const featured = useMemo(
    () =>
      books
        .filter((b) => b.isFeatured)
        .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0)),
    [books]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      const matchCategory =
        activeCategory === ALL_CATEGORY ||
        b.category === activeCategory ||
        (b.categories ?? []).includes(activeCategory);
      if (!matchCategory) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [books, query, activeCategory]);

  const handleBuy = useCallback((book: AmazonBook) => {
    if (book._id) void trackBookClick(book._id);
    window.open(book.amazonUrl, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader />
      <Hero bookCount={books.length} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {loading ? (
          <LoadingGrid />
        ) : error ? (
          <ErrorState message={error} />
        ) : books.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {featured.length > 0 && (
              <FeaturedSection books={featured} onSelect={setSelected} />
            )}

            <section id="shelf" className="mt-12 sm:mt-16 scroll-mt-20">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="font-display text-3xl sm:text-4xl text-sky-900">Browse the shelf</h2>
                  <p className="text-sky-800/70 mt-1">
                    {filtered.length} {filtered.length === 1 ? 'book' : 'books'}
                    {activeCategory !== ALL_CATEGORY && (
                      <>
                        {' '}
                        in <span className="font-semibold">{activeCategory}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="relative w-full md:w-80">
                  <Search className="w-5 h-5 text-sky-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title or author"
                    className="w-full pl-10 pr-4 py-2.5 rounded-full border border-sky-200 bg-white/90 shadow-sm focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-400 text-sm text-sky-900"
                  />
                </div>
              </div>

              {categories.length > 1 && (
                <CategoryTabs
                  categories={categories}
                  active={activeCategory}
                  onChange={setActiveCategory}
                />
              )}

              {filtered.length === 0 ? (
                <div className="text-center py-16 text-sky-800/70">
                  No books match your search.
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6">
                  {filtered.map((book) => (
                    <BookCard key={book._id} book={book} onSelect={setSelected} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <SiteFooter />

      {selected && (
        <BookDetailModal
          book={selected}
          onClose={() => setSelected(null)}
          onBuy={handleBuy}
        />
      )}
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-sky-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-sky-800 flex items-center justify-center shadow-md">
            <BookOpen className="w-5 h-5 text-gold-300" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg text-sky-900">Godly Kids</div>
            <div className="text-xs uppercase tracking-widest text-gold-600">Bookstore</div>
          </div>
        </a>
        <a
          href="https://godlykids.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1"
        >
          Visit godlykids.com
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
}

function Hero({ bookCount }: { bookCount: number }) {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-10 sm:pb-12">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
          <div className="flex-1">
            <span className="inline-flex items-center gap-2 bg-white/80 text-sky-800 border border-sky-200 rounded-full px-3 py-1 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-gold-500" /> Faith-filled books for growing hearts
            </span>
            <h1 className="mt-4 font-display text-4xl sm:text-5xl lg:text-6xl text-sky-900 leading-tight">
              The <span className="text-gold-500">Godly Kids</span> Bookstore
            </h1>
            <p className="mt-4 text-sky-800/80 text-lg max-w-2xl">
              Handpicked books that help kids know God, love His Word, and live with courage.
              Every title ships straight from Amazon.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#shelf"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gold-400 text-sky-900 font-bold shadow-gold hover:bg-gold-300 transition"
              >
                <ShoppingBag className="w-5 h-5" /> Shop the shelf
              </a>
              {bookCount > 0 && (
                <span className="text-sm text-sky-700/80">
                  {bookCount} {bookCount === 1 ? 'title' : 'titles'} available
                </span>
              )}
            </div>
          </div>

          <div className="hidden md:block flex-shrink-0">
            <div className="relative w-64 h-64">
              <div className="absolute inset-0 bg-gradient-to-br from-sky-200 to-sky-500 rounded-3xl rotate-6 shadow-card" />
              <div className="absolute inset-0 bg-white rounded-3xl -rotate-3 shadow-card flex items-center justify-center">
                <BookOpen className="w-24 h-24 text-sky-500" />
                <Star
                  className="absolute top-4 right-4 w-7 h-7 text-gold-400"
                  fill="currentColor"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
      {categories.map((c) => {
        const isActive = c === active;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold border transition ${
              isActive
                ? 'bg-sky-700 text-white border-sky-700 shadow-sm'
                : 'bg-white/80 text-sky-800 border-sky-200 hover:border-gold-400 hover:bg-white'
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

function FeaturedSection({
  books,
  onSelect,
}: {
  books: AmazonBook[];
  onSelect: (b: AmazonBook) => void;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-5">
        <Star className="w-5 h-5 text-gold-500" fill="currentColor" />
        <h2 className="font-display text-2xl sm:text-3xl text-sky-900">Featured picks</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
        {books.map((book) => (
          <BookCard key={`f-${book._id}`} book={book} onSelect={onSelect} featured />
        ))}
      </div>
    </section>
  );
}

function BookCard({
  book,
  onSelect,
  featured = false,
}: {
  book: AmazonBook;
  onSelect: (b: AmazonBook) => void;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(book)}
      className="group text-left bg-white rounded-2xl overflow-hidden shadow-card border border-sky-100 hover:border-gold-300 hover:-translate-y-1 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400"
      aria-label={`Open ${book.title} details`}
    >
      <div className="relative aspect-[2/3] bg-sky-50 overflow-hidden">
        {book.coverImage ? (
          <img
            src={book.coverImage}
            alt={book.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sky-300">
            <BookOpen className="w-12 h-12" />
          </div>
        )}

        {book.badgeText && (
          <span
            className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow"
            style={{ backgroundColor: book.badgeColor || '#ffb703' }}
          >
            {book.badgeText}
          </span>
        )}
        {featured && !book.badgeText && (
          <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold text-sky-900 bg-gold-400 shadow inline-flex items-center gap-1">
            <Star className="w-3 h-3" fill="currentColor" /> Featured
          </span>
        )}
        {book.price && (
          <span className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-[11px] font-bold text-sky-900 bg-gold-300 shadow">
            {book.price}
          </span>
        )}
        {book.promoVideoUrl && (
          <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-sky-700/80 backdrop-blur px-2 py-1 rounded-full inline-flex items-center gap-1">
            <PlayCircle className="w-3 h-3" /> Video
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-sky-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="inline-flex items-center gap-1 text-white text-xs font-semibold">
            See details <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <h3 className="font-semibold text-sm sm:text-base text-sky-900 line-clamp-2 leading-snug">
          {book.title}
        </h3>
        <p className="text-xs sm:text-sm text-sky-700/70 mt-0.5">by {book.author}</p>
        {(book.reviews?.length ?? 0) > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-sky-700/80">
            <StarRating rating={avgRating(book.reviews)} />
            <span className="text-sky-800/60">({book.reviews?.length})</span>
          </div>
        )}
      </div>
    </button>
  );
}

function LoadingGrid() {
  return (
    <section className="mt-10">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl overflow-hidden shadow-card border border-sky-100"
          >
            <div className="aspect-[2/3] bg-sky-100 animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-4 rounded bg-sky-100 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-sky-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 text-center bg-white/70 border-2 border-dashed border-sky-200 rounded-2xl p-12">
      <BookOpen className="w-14 h-14 text-sky-400 mx-auto mb-4" />
      <h3 className="font-display text-2xl text-sky-900">New books coming soon</h3>
      <p className="text-sky-800/80 mt-2">
        We're curating our first collection. Check back soon for faith-filled reads!
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mt-16 text-center bg-red-50 border border-red-200 rounded-2xl p-8">
      <h3 className="font-semibold text-red-800">We couldn't load the bookstore</h3>
      <p className="text-sm text-red-700 mt-1">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-sky-100 bg-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-sky-800/80">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-sky-700" />
          <span>
            &copy; {new Date().getFullYear()} Godly Kids. Purchases are fulfilled by Amazon.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://godlykids.com"
            className="hover:text-sky-900"
            target="_blank"
            rel="noopener noreferrer"
          >
            godlykids.com
          </a>
          <a
            href="https://godlykids.com/privacy"
            className="hover:text-sky-900"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------- Modal ---------------------------------- */

function BookDetailModal({
  book,
  onClose,
  onBuy,
}: {
  book: AmazonBook;
  onClose: () => void;
  onBuy: (b: AmazonBook) => void;
}) {
  const gallery = useMemo(
    () => [book.coverImage, ...(book.images ?? [])].filter(Boolean) as string[],
    [book.coverImage, book.images]
  );
  const [activeImage, setActiveImage] = useState(0);

  const prev = () => setActiveImage((i) => (i - 1 + gallery.length) % gallery.length);
  const next = () => setActiveImage((i) => (i + 1) % gallery.length);
  const reviewCount = book.reviews?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-sky-950/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-4xl sm:my-10 sm:rounded-3xl overflow-hidden shadow-2xl border border-sky-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-sky-800 shadow-md flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid md:grid-cols-5 gap-0">
          <div className="md:col-span-2 bg-gradient-to-br from-sky-50 to-sky-100 p-4 sm:p-6">
            <div className="relative aspect-[2/3] bg-white rounded-2xl overflow-hidden shadow-card">
              {gallery.length > 0 ? (
                <img
                  src={gallery[activeImage]}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sky-300">
                  <BookOpen className="w-16 h-16" />
                </div>
              )}

              {book.badgeText && (
                <span
                  className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold text-white shadow"
                  style={{ backgroundColor: book.badgeColor || '#ffb703' }}
                >
                  {book.badgeText}
                </span>
              )}

              {gallery.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-sky-800 flex items-center justify-center shadow"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-sky-800 flex items-center justify-center shadow"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {gallery.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImage(i)}
                        className={`w-2 h-2 rounded-full transition ${
                          i === activeImage ? 'bg-gold-400 w-5' : 'bg-white/80'
                        }`}
                        aria-label={`Image ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {gallery.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    onClick={() => setActiveImage(i)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 ${
                      i === activeImage ? 'border-gold-400' : 'border-transparent hover:border-sky-300'
                    }`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-3 p-5 sm:p-7 space-y-5">
            <div>
              {book.category && (
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                  {book.category}
                </span>
              )}
              <h2 className="mt-1 font-display text-2xl sm:text-3xl text-sky-900 leading-tight">
                {book.title}
              </h2>
              <p className="text-sky-700/80 mt-1">by {book.author}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {reviewCount > 0 && (
                  <div className="inline-flex items-center gap-2 bg-gold-100 text-sky-900 px-3 py-1 rounded-full">
                    <StarRating rating={avgRating(book.reviews)} />
                    <span className="text-sm font-semibold">
                      {avgRating(book.reviews).toFixed(1)}
                    </span>
                    <span className="text-xs text-sky-700/80">
                      ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>
                )}
                {book.price && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-700 text-white text-sm font-bold">
                    {book.price}
                  </span>
                )}
              </div>
            </div>

            {book.description && (
              <div>
                <h3 className="font-display text-lg text-sky-900 mb-1">About this book</h3>
                <p className="text-sky-800/90 leading-relaxed whitespace-pre-line">
                  {book.description}
                </p>
              </div>
            )}

            {book.promoVideoUrl && (
              <div>
                <h3 className="font-display text-lg text-sky-900 mb-2 flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-gold-500" />
                  Watch the preview
                </h3>
                <VideoPlayer url={book.promoVideoUrl} title={book.title} />
              </div>
            )}

            {reviewCount > 0 && (
              <div>
                <h3 className="font-display text-lg text-sky-900 mb-2">
                  What parents are saying
                </h3>
                <div className="space-y-3">
                  {book.reviews!.map((r, i) => (
                    <ReviewCard key={r._id ?? i} review={r} />
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => onBuy(book)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-gold-400 hover:bg-gold-300 text-sky-900 font-bold text-lg shadow-gold transition"
              >
                <ShoppingBag className="w-5 h-5" />
                Buy on Amazon
                <ExternalLink className="w-4 h-4" />
              </button>
              <p className="text-xs text-sky-700/70 mt-2">
                Opens Amazon in a new tab. Godly Kids never stores your payment info.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-sky-50/80 border border-sky-100 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-700 flex items-center justify-center text-white font-bold text-sm">
            {(review.author || '?').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-sky-900 leading-tight">
              {review.author || 'Anonymous'}
            </div>
            {review.date && (
              <div className="text-[11px] text-sky-700/70">
                {new Date(review.date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            )}
          </div>
        </div>
        <StarRating rating={review.rating} />
      </div>
      {review.text && (
        <p className="text-sm text-sky-800/90 mt-2 leading-relaxed">{review.text}</p>
      )}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="inline-flex items-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${n <= clamped ? 'text-gold-500' : 'text-sky-200'}`}
          fill={n <= clamped ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );
}

function avgRating(reviews: Review[] | undefined): number {
  if (!reviews || reviews.length === 0) return 0;
  const total = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
  return total / reviews.length;
}

/* ---------------------------- Video embed ------------------------------- */

function VideoPlayer({ url, title }: { url: string; title: string }) {
  const embed = getEmbedSource(url);

  if (embed.kind === 'iframe') {
    return (
      <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-card">
        <iframe
          src={embed.src}
          title={`${title} promo video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  if (embed.kind === 'video') {
    return (
      <div className="rounded-2xl overflow-hidden bg-black shadow-card">
        <video src={embed.src} controls className="w-full h-auto" />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sky-700 hover:text-sky-900 text-sm font-semibold"
    >
      <PlayCircle className="w-4 h-4" />
      Watch the promo video
      <ExternalLink className="w-3.5 h-3.5" />
    </a>
  );
}

type EmbedSource =
  | { kind: 'iframe'; src: string }
  | { kind: 'video'; src: string }
  | { kind: 'link'; src: string };

function getEmbedSource(raw: string): EmbedSource {
  const url = raw.trim();
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    // YouTube (watch, youtu.be, shorts, embed)
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      let videoId = u.searchParams.get('v');
      if (!videoId && u.pathname.startsWith('/shorts/')) {
        videoId = u.pathname.split('/')[2] ?? null;
      }
      if (!videoId && u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.split('/')[2] ?? null;
      }
      if (videoId) {
        return { kind: 'iframe', src: `https://www.youtube.com/embed/${videoId}?rel=0` };
      }
    }
    if (host === 'youtu.be') {
      const videoId = u.pathname.slice(1);
      if (videoId) {
        return { kind: 'iframe', src: `https://www.youtube.com/embed/${videoId}?rel=0` };
      }
    }

    // Vimeo
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) {
        return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` };
      }
    }
    if (host === 'player.vimeo.com') {
      return { kind: 'iframe', src: url };
    }

    // Direct video files
    if (/\.(mp4|webm|ogg|m4v|mov)(\?|$)/i.test(u.pathname)) {
      return { kind: 'video', src: url };
    }
  } catch {
    // fallthrough
  }
  return { kind: 'link', src: url };
}

export default App;
