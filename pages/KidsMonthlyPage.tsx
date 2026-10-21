import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import { getMonthlyBookBaseUrl } from '../services/apiService';
import { authService } from '../services/authService';
import { BookOpen, Loader2, ChevronRight } from 'lucide-react';
import { FEATURE_CREATE_YOUR_STORY } from '../constants';

/** From GET /api/monthly-book/my-books — only kid-created books (not templates). */
interface MyMonthlyBook {
  customMonthlyBookId: string;
  bookId: string | null;
  title: string;
  coverImageUrl: string | null;
  childName?: string;
  createdAt: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  pageCount?: number;
}

/**
 * Dedicated Kids Monthly section: only books created by/for this user (CustomMonthlyBook).
 * These are for viewing in the app only — not published to the main catalog.
 */
const KidsMonthlyPage: React.FC = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState<MyMonthlyBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const userId = authService.getUserIdForBackend();

  const fetchBooks = React.useCallback(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`${getMonthlyBookBaseUrl()}/monthly-book/my-books?userId=${encodeURIComponent(userId)}&includeInProgress=1`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (data.success && Array.isArray(data.books)) {
          setBooks(data.books);
          setError(null);
        } else if (!data.success) {
          setError(data.error || 'Could not load your books.');
        }
      })
      .catch(() => setError('Could not load your books.'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchBooks();
  }, [fetchBooks]);

  // Refetch when user returns to this page so in-progress and newly completed books show up.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && userId) fetchBooks();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, fetchBooks]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const current = scrollRef.current.scrollTop;
    if (current < 50) {
      setHeaderVisible(true);
    } else {
      setHeaderVisible(current <= lastScrollY.current);
    }
    lastScrollY.current = current;
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar"
    >
      <Header isVisible={headerVisible} title="KIDS MONTHLY" />

      <div className="px-4 pt-28 pb-32">
        <p className="text-white/70 text-sm mb-6">
          Stories you created with &quot;Create your story&quot; — just for you, not in the main library.
        </p>

        {FEATURE_CREATE_YOUR_STORY && (
          <button
            type="button"
            onClick={() => navigate('/create-your-story')}
            className="w-full mb-8 rounded-2xl overflow-hidden border-2 border-amber-400/60 bg-gradient-to-br from-amber-600/40 to-amber-800/50 shadow-xl active:scale-[0.98] transition-transform"
          >
            <div className="p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-amber-500/30 flex items-center justify-center shrink-0">
                <BookOpen className="w-8 h-8 text-amber-200" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <h2 className="text-white font-bold text-lg">Create your story</h2>
                <p className="text-amber-100/90 text-sm mt-0.5">A new adventure with you in it.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-200 shrink-0" />
            </div>
          </button>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
            <span className="text-white/60 text-sm">Loading your books...</span>
          </div>
        ) : error ? (
          <p className="py-6 text-red-300/90 text-sm">{error}</p>
        ) : books.length === 0 ? (
          <div className="py-8 rounded-xl bg-white/5 border border-white/10 text-center">
            <BookOpen className="w-12 h-12 text-amber-200/50 mx-auto mb-3" />
            <p className="text-white/80 font-medium">No stories yet</p>
            <p className="text-white/50 text-sm mt-1">Use &quot;Create your story&quot; above to make one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {books.map((item) => (
              <div key={item.customMonthlyBookId} className="flex flex-col">
                {item.status === 'completed' && item.bookId ? (
                  <>
                    <BookCard
                      book={{
                        id: item.bookId,
                        title: item.title,
                        coverUrl: item.coverImageUrl || '',
                        author: item.childName,
                      } as any}
                      onClick={(id) => navigate(`/book/${id}`, { state: { from: '/kids-monthly' } })}
                    />
                  </>
                ) : item.status === 'failed' ? (
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden border-2 border-red-400/40">
                    <div className="aspect-square relative bg-gradient-to-br from-red-900/40 to-amber-900/30 flex flex-col items-center justify-center p-3">
                      <BookOpen className="w-12 h-12 text-red-300/80" />
                      <span className="text-red-200 text-sm font-bold text-center mt-2">Couldn’t create</span>
                      <span className="text-red-200/80 text-xs text-center mt-1">Try again with &quot;Create your story&quot;</span>
                    </div>
                    <div className="p-2">
                      <p className="text-white font-medium text-sm truncate">{item.title}</p>
                      <p className="text-red-300/80 text-xs">Creation failed</p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (item.bookId) {
                        navigate(`/book/${item.bookId}`, { state: { customMonthlyBookId: item.customMonthlyBookId, isGenerating: true } });
                      } else {
                        navigate(`/library/creating/${item.customMonthlyBookId}`);
                      }
                    }}
                    className="w-full text-left bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden border-2 border-amber-400/30 hover:border-amber-400/50 active:scale-[0.98] transition-all"
                  >
                    <div className="aspect-square relative bg-gradient-to-br from-amber-900/40 to-amber-800/30">
                      {item.coverImageUrl ? (
                        <img
                          src={item.coverImageUrl}
                          alt=""
                          className="w-full h-full object-cover opacity-80"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-12 h-12 text-amber-200/60" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-2">
                        <Loader2 className="w-10 h-10 text-amber-300 animate-spin" aria-hidden />
                        <span className="text-amber-200 text-sm font-bold text-center px-2">Creating...</span>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-white font-medium text-sm truncate">{item.title}</p>
                      <p className="text-amber-200/80 text-xs">Tap to see progress</p>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KidsMonthlyPage;
