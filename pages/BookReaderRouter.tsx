import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ApiService } from '../services/apiService';
import { authService } from '../services/authService';
import BookReaderPage from './BookReaderPage';
import VerticalFeedReader from '../components/features/VerticalFeedReader';
import { isValidBookId } from '../utils/bookUtils';

/**
 * Dispatcher for /read/:bookId. Peeks at the book's `readerLayout`:
 * - 'swipe_up' → renders the vertical TikTok-style feed reader
 * - anything else (default) → renders the existing BookReaderPage
 *
 * The fetched book is forwarded to VerticalFeedReader to avoid a duplicate
 * round-trip; BookReaderPage owns its own data lifecycle and is kept untouched.
 */
const BookReaderRouter: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();
    const [searchParams] = useSearchParams();
    const shareToken = searchParams.get('share') || undefined;

    const [layout, setLayout] = useState<'side_swipe' | 'swipe_up' | null>(null);
    const [book, setBook] = useState<any>(null);
    const [resolved, setResolved] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const peek = async () => {
            if (!bookId || !isValidBookId(bookId)) {
                if (!cancelled) {
                    setLayout('side_swipe');
                    setResolved(true);
                }
                return;
            }
            try {
                const userId = authService.getUserIdForBackend();
                const b = await ApiService.getBookById(bookId, userId, shareToken || null);
                if (cancelled) return;
                const raw = (b as any)?.rawData || {};
                const detected: 'side_swipe' | 'swipe_up' =
                    raw.readerLayout === 'swipe_up' || (b as any)?.readerLayout === 'swipe_up'
                        ? 'swipe_up'
                        : 'side_swipe';
                setBook(b);
                setLayout(detected);
            } catch (err) {
                console.warn('BookReaderRouter: failed to peek book, falling back to side_swipe', err);
                if (!cancelled) setLayout('side_swipe');
            } finally {
                if (!cancelled) setResolved(true);
            }
        };
        peek();
        return () => { cancelled = true; };
    }, [bookId, shareToken]);

    if (!resolved) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                <div className="text-white/70 text-sm">Loading…</div>
            </div>
        );
    }

    if (layout === 'swipe_up' && bookId) {
        return <VerticalFeedReader bookId={bookId} book={book} shareToken={shareToken || null} />;
    }

    return <BookReaderPage />;
};

export default BookReaderRouter;
