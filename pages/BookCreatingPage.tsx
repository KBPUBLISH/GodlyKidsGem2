import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMonthlyBookBaseUrl } from '../services/apiService';
import Header from '../components/layout/Header';
import { BookOpen, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

/** ~seconds per page (generation + delay); used for ETA */
const ESTIMATED_SECONDS_PER_PAGE = 18;

interface StatusResponse {
  success: boolean;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  bookId: string | null;
  title: string | null;
  coverImageUrl: string | null;
  progressPage: number;
  progressTotalPages: number;
  errorMessage?: string | null;
}

const BookCreatingPage: React.FC = () => {
  const { customMonthlyBookId } = useParams<{ customMonthlyBookId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!customMonthlyBookId) return;
    try {
      const res = await fetch(`${getMonthlyBookBaseUrl()}/monthly-book/status/${customMonthlyBookId}`);
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setStatus(data);
        setError(null);
      } else {
        setError(data.error || 'Could not load status.');
      }
    } catch (e) {
      setError('Could not load status.');
    } finally {
      setLoading(false);
    }
  }, [customMonthlyBookId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!customMonthlyBookId || !status) return;
    if (status.status === 'completed' && status.bookId) {
      navigate(`/book/${status.bookId}`, { replace: true });
      return;
    }
    if (status.status === 'failed' || status.status === 'completed') return;
    const interval = setInterval(fetchStatus, 2500);
    return () => clearInterval(interval);
  }, [customMonthlyBookId, status?.status, status?.bookId, navigate, fetchStatus]);

  if (!customMonthlyBookId) {
    navigate('/library', { replace: true });
    return null;
  }

  if (loading && !status) {
    return (
      <>
        <div className="fixed inset-0 z-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: 'url(/assets/images/create-story-curtain.png)' }} aria-hidden />
        <Header isVisible={true} title="MY LIBRARY" />
        <div className="relative z-10 flex flex-col min-h-full items-center justify-center px-4 pt-24">
          <Loader2 className="w-12 h-12 text-amber-400 animate-spin mb-4" />
          <p className="text-white/80">Loading...</p>
        </div>
      </>
    );
  }

  if (error && !status) {
    return (
      <>
        <div className="fixed inset-0 z-0 bg-cover bg-center pointer-events-none" style={{ backgroundImage: 'url(/assets/images/create-story-curtain.png)' }} aria-hidden />
        <Header isVisible={true} title="MY LIBRARY" />
        <div className="relative z-10 flex flex-col min-h-full items-center justify-center px-4 pt-24">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-white/80 text-center mb-4">{error}</p>
          <button
            onClick={() => navigate('/library', { state: { fromCreating: true } })}
            className="px-6 py-3 rounded-xl bg-amber-500 text-white font-bold flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" /> Back to My Library
          </button>
        </div>
      </>
    );
  }

  const isGenerating = status?.status === 'pending' || status?.status === 'generating';
  const current = status?.progressPage ?? 0;
  const total = status?.progressTotalPages || 1;
  const remaining = Math.max(0, total - current);
  const etaSeconds = remaining * ESTIMATED_SECONDS_PER_PAGE;
  const etaMinutes = Math.ceil(etaSeconds / 60);

  return (
    <>
      {/* Theatrical curtain background (same as Create Your Story creating view) */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: 'url(/assets/images/create-story-curtain.png)' }}
        aria-hidden
      />
      <Header isVisible={true} title="MY LIBRARY" />
      <div className="relative z-10 flex flex-col min-h-full px-4 pt-24 pb-12" style={{ paddingTop: 'max(6rem, calc(var(--safe-area-top, 0px) + 4rem))' }}>
        <button
          onClick={() => navigate('/library', { state: { fromCreating: true } })}
          className="self-start flex items-center gap-2 text-amber-200 hover:text-amber-100 mb-6"
        >
          <ArrowLeft className="w-5 h-5" /> Back to My Library
        </button>

        {status?.status === 'failed' && (
          <div className="rounded-2xl border-2 border-red-400/50 bg-red-500/10 p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">Creation failed</h2>
            <p className="text-red-200/90 text-sm mb-4">{status.errorMessage || 'Something went wrong.'}</p>
            <p className="text-white/70 text-sm mb-4">Try again with &quot;Create your story&quot; from My Library.</p>
            <button
              onClick={() => navigate('/library', { state: { fromCreating: true } })}
              className="px-6 py-3 rounded-xl bg-amber-500 text-white font-bold"
            >
              Back to My Library
            </button>
          </div>
        )}

        {status?.status === 'completed' && !status.bookId && (
          <div className="text-center py-8">
            <p className="text-white/80">Your book is ready. Taking you there...</p>
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto mt-4" />
          </div>
        )}

        {isGenerating && status && (
          <div className="max-w-md mx-auto">
            <div className="rounded-2xl overflow-hidden border-2 border-amber-400/40 bg-gradient-to-b from-amber-900/30 to-amber-950/20 shadow-xl">
              <div className="aspect-[9/12] relative bg-amber-950/40">
                {status.coverImageUrl ? (
                  <img
                    src={status.coverImageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-24 h-24 text-amber-200/50" />
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-4 p-4">
                  <Loader2 className="w-14 h-14 text-amber-300 animate-spin" aria-hidden />
                  <p className="text-amber-200 font-bold text-center text-lg">
                    Page {current + 1} of {total} in progress
                  </p>
                  <p className="text-amber-200/80 text-sm text-center">
                    {current > 0 ? `${current} page${current === 1 ? '' : 's'} done. ` : ''}
                    Creating your story...
                  </p>
                  {remaining > 0 && (
                    <p className="text-amber-100/70 text-sm">
                      About {etaMinutes} min remaining
                    </p>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h2 className="text-white font-bold text-lg truncate">{status.title || 'Your story'}</h2>
                <p className="text-amber-200 font-medium text-sm mt-2">
                  {current} of {total} pages done
                </p>
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: total ? `${(current / total) * 100}%` : '0%' }}
                  />
                </div>
                {status.status === 'completed' && status.bookId ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/book/${status.bookId}`)}
                    className="mt-4 w-full py-3 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-amber-600 active:scale-[0.98]"
                  >
                    <BookOpen className="w-5 h-5" />
                    Also read
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-4 w-full py-3 rounded-xl bg-white/10 text-white/50 font-bold flex items-center justify-center gap-2 cursor-not-allowed border border-white/20"
                  >
                    <BookOpen className="w-5 h-5" />
                    Also read — available when ready
                  </button>
                )}
              </div>
            </div>
            <p className="text-center text-white/50 text-sm mt-4">
              Usually ready in 5–10 minutes. Go explore the app — your book will show in My Library when it’s done.
              {status.bookId && current > 0 && ' You can open it now to preview while the rest generate.'}
            </p>
            {isGenerating && total > 0 && current < total && (
              <div className="text-center mt-4">
                <button
                  type="button"
                  disabled={retrying}
                  onClick={async () => {
                    if (!customMonthlyBookId) return;
                    setRetrying(true);
                    try {
                      const res = await fetch(`${getMonthlyBookBaseUrl()}/monthly-book/retry/${customMonthlyBookId}`, { method: 'POST' });
                      const data = await res.json().catch(() => ({}));
                      if (data.success) {
                        await fetchStatus();
                      }
                    } finally {
                      setRetrying(false);
                    }
                  }}
                  className="text-amber-300 hover:text-amber-200 text-sm underline disabled:opacity-50"
                >
                  {retrying ? 'Retrying…' : 'Generation stuck? Tap to resume from next page'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default BookCreatingPage;
