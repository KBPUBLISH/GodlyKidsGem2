import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  Hammer,
  Headphones,
  Heart,
  Lock,
  Play,
  Share2,
  Shield,
  Star,
  Users,
} from 'lucide-react';
import { hubService, type SeriesReview } from '../services/hubService';
import CreditPackSheet from '../components/credits/CreditPackSheet';
import {
  plannedCount,
  releasedCount,
  type CreatorEpisode,
  type CreatorStory,
} from '../utils/creatorStories';

const NAVY = '#173A5E';
const CREAM = '#F7F0E6';
const MUTED = '#8A7A68';
const COIN = '/assets/ui/coin.png';

const StarRating = ({ rating, reviews }: { rating: number; reviews: number }) => (
  <div className="flex items-center gap-1">
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          className={i < Math.round(rating) ? 'fill-[#E8B923] text-[#E8B923]' : 'text-[#D4C4B0]'}
        />
      ))}
    </div>
    <span className="font-display text-[12px] font-bold" style={{ color: NAVY }}>
      {rating.toFixed(1)}
    </span>
    {reviews > 0 && (
      <span className="font-display text-[12px]" style={{ color: MUTED }}>
        ({reviews} reviews)
      </span>
    )}
  </div>
);

/** Sub-line under an episode title. Empty when the API gave us nothing to say. */
const episodeMeta = (episode: CreatorEpisode, pledged: boolean): string => {
  if (episode.planned) {
    return `Coming ${episode.eta ?? 'soon'}${pledged ? ' • Yours when it lands' : ''}`;
  }
  return [
    episode.minutes != null ? `${episode.minutes} min` : null,
    episode.free ? 'Free preview' : null,
  ]
    .filter(Boolean)
    .join(' • ');
};

const StatChip = ({ label, value }: { label: string; value: string }) => (
  <div
    className="flex-1 rounded-2xl px-3 py-2.5 text-center"
    style={{ background: '#F8EBDA' }}
  >
    <p className="font-display font-black text-sm leading-none" style={{ color: NAVY }}>
      {value}
    </p>
    <p className="font-display text-[10px] mt-1" style={{ color: MUTED }}>
      {label}
    </p>
  </div>
);

const MoreCard: React.FC<{ story: CreatorStory; onOpen: () => void }> = ({
  story,
  onOpen,
}) => (
  <button
    type="button"
    onClick={onOpen}
    className="shrink-0 w-[10.5rem] text-left rounded-[1.25rem] overflow-hidden bg-white shadow-[0_2px_10px_rgba(23,58,94,0.08)] active:scale-[0.98] transition-transform"
  >
    <div className="relative w-full aspect-video overflow-hidden bg-[#ead9c4]">
      <img src={story.cover} alt="" className="w-full h-full object-cover" />
      <span
        className={`absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display font-black text-[10px] text-white shadow-md ${
          story.format === 'audio' ? 'bg-[#2563eb]' : 'bg-[#16a34a]'
        }`}
      >
        {story.format === 'audio' ? <Headphones size={10} /> : <BookOpen size={10} />}
        {story.format === 'audio' ? 'Audio' : 'Read'}
      </span>
    </div>
    <div className="px-2.5 pt-2 pb-2.5">
      <p
        className="font-display font-black text-[12px] leading-snug line-clamp-2"
        style={{ color: NAVY }}
      >
        {story.title}
      </p>
      {story.ages && (
        <p className="font-display text-[10px] mt-0.5" style={{ color: MUTED }}>
          {story.ages}
        </p>
      )}
    </div>
  </button>
);

const CreatorStoryDetailPage: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [story, setStory] = useState<CreatorStory | null>(null);
  const [moreFromCreator, setMoreFromCreator] = useState<CreatorStory[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  // Front-end only: a pledge is remembered for the session so the screen can
  // show the backed state. Wire to the purchase API when it exists.
  const [pledged, setPledged] = useState(false);
  const [showPledgeSheet, setShowPledgeSheet] = useState(false);
  const [showCreditPacks, setShowCreditPacks] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [reviews, setReviews] = useState<SeriesReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState({ average: 0, count: 0 });
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewTone, setReviewTone] = useState<'ok' | 'err' | null>(null);
  const [myReviewPending, setMyReviewPending] = useState(false);

  const load = useCallback(async () => {
    if (!storyId) {
      setStatus('missing');
      return;
    }

    setStatus('loading');
    try {
      const loaded = await hubService.getSeries(storyId);
      if (!loaded) {
        setStory(null);
        setMoreFromCreator([]);
        setStatus('missing');
        return;
      }

      setStory(loaded);
      setStatus('ready');
      setMoreFromCreator(
        await hubService
          .getMoreFromCreator(loaded.creatorId, loaded.id)
          .catch(() => [] as CreatorStory[]),
      );
      if (loaded.creatorId) {
        const creator = await hubService.getCreator(loaded.creatorId).catch(() => null);
        if (creator) setFollowing(creator.following);
      }
      const reviewData = await hubService.getReviews(loaded.id).catch(() => null);
      if (reviewData) {
        setReviews(reviewData.reviews);
        setReviewSummary({ average: reviewData.averageRating, count: reviewData.ratingCount });
        if (reviewData.myReview) {
          setMyRating(reviewData.myReview.rating);
          setMyComment(reviewData.myReview.comment || '');
          setMyReviewPending(reviewData.myReview.status === 'pending');
        }
      }
    } catch (error) {
      console.warn('Failed to load creator story:', error);
      setStatus('error');
    }
  }, [storyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const backToCreators = () =>
    navigate('/listen', { state: { libraryMode: 'creators' } });

  if (status === 'loading') {
    return (
      <div
        className="h-full flex items-center justify-center font-display font-bold"
        style={{ background: CREAM, color: NAVY }}
      >
        Loading story...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="h-full flex flex-col items-center justify-center px-6 text-center"
        style={{ background: CREAM }}
      >
        <p className="font-display font-bold" style={{ color: NAVY }}>
          We couldn&apos;t reach the story shelf.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-full px-5 py-2.5 font-display font-black text-sm text-white"
          style={{ background: NAVY }}
        >
          Try Again
        </button>
        <button
          type="button"
          onClick={backToCreators}
          className="mt-2 rounded-full px-5 py-2.5 font-display font-bold text-sm"
          style={{ color: MUTED }}
        >
          Back to Creators
        </button>
      </div>
    );
  }

  if (!story) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center px-6 text-center"
        style={{ background: CREAM }}
      >
        <p className="font-display font-bold" style={{ color: NAVY }}>
          This story isn&apos;t available right now.
        </p>
        <button
          type="button"
          onClick={backToCreators}
          className="mt-4 rounded-full px-5 py-2.5 font-display font-black text-sm text-white"
          style={{ background: NAVY }}
        >
          Back to Creators
        </button>
      </div>
    );
  }

  const isAudio = story.format === 'audio';
  const unit = isAudio ? 'episode' : 'chapter';
  const inProgress = story.seriesStatus === 'in-progress';
  const released = releasedCount(story);
  const planned = plannedCount(story);
  const releasedMinutes = story.episodeList
    .filter((ep) => !ep.planned)
    .reduce((sum, ep) => sum + (ep.minutes ?? 0), 0);
  const releaseProgress = planned > 0 ? Math.round((released / planned) * 100) : 0;
  const hasFreePreview = story.episodeList.some((ep) => ep.free);
  const backerCount = (story.backers ?? 0) + (pledged ? 1 : 0);

  // The app shell is a fixed-height flex column with overflow hidden, so this
  // page owns its own scroller (same as BookDetailPage).
  return (
    <div className="h-full overflow-y-auto no-scrollbar" style={{ background: CREAM }}>
      {/* Widescreen cover with the back / share / save controls floating on top.
          Capped so the artwork never swallows the whole viewport on tall screens. */}
      <div
        className="relative w-full aspect-video overflow-hidden bg-[#ead9c4]"
        style={{ maxHeight: 'min(42vh, 320px)' }}
      >
        <img src={story.cover} alt="" className="w-full h-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(8,22,44,0.55) 100%)',
          }}
        />

        <div
          className="absolute left-3 right-3 flex items-center justify-between"
          style={{ top: 'max(12px, calc(var(--safe-area-top, 0px) + 8px))' }}
        >
          <button
            type="button"
            onClick={backToCreators}
            aria-label="Back to Creators"
            className="w-10 h-10 rounded-full bg-white/95 shadow-[0_2px_8px_rgba(8,22,44,0.35)] flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft size={20} style={{ color: NAVY }} />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Save story"
              className="w-10 h-10 rounded-full bg-white/95 shadow-[0_2px_8px_rgba(8,22,44,0.35)] flex items-center justify-center active:scale-95 transition-transform"
            >
              <Heart size={18} style={{ color: NAVY }} />
            </button>
            <button
              type="button"
              aria-label="Share story"
              className="w-10 h-10 rounded-full bg-white/95 shadow-[0_2px_8px_rgba(8,22,44,0.35)] flex items-center justify-center active:scale-95 transition-transform"
            >
              <Share2 size={18} style={{ color: NAVY }} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
          {inProgress && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display font-black text-[11px] text-white shadow-md bg-[#E8890C]">
              <Hammer size={12} />
              In Progress
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display font-black text-[11px] text-white shadow-md ${
              isAudio ? 'bg-[#2563eb]' : 'bg-[#16a34a]'
            }`}
          >
            {isAudio ? <Headphones size={12} /> : <BookOpen size={12} />}
            {isAudio ? 'Audiobook' : 'Read-Along'}
          </span>
        </div>
      </div>

      <div
        className="px-4 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 2rem)' }}
      >
        {/* Title + creator */}
        <h1 className="font-display font-black text-[1.5rem] leading-tight" style={{ color: NAVY }}>
          {story.title}
        </h1>

        <button
          type="button"
          onClick={() => story.creatorId && navigate(`/creators/${story.creatorId}`)}
          className="mt-3 w-full flex items-center gap-3 rounded-[1.1rem] bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(23,58,94,0.06)] active:scale-[0.99] transition-transform text-left"
        >
          <div className="w-14 h-14 rounded-full overflow-hidden bg-[#ead9c4] shrink-0">
            <img src={story.creatorAvatar} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-black text-sm truncate" style={{ color: NAVY }}>
              {story.creator}
            </p>
            <p className="font-display text-[11px] mt-0.5" style={{ color: MUTED }}>
              Creator profile
            </p>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              if (!story.creatorId || followBusy) return;
              setFollowBusy(true);
              void hubService
                .followCreator(story.creatorId, !following)
                .then((next) => setFollowing(next))
                .catch((error: Error) => setReviewMessage(error.message))
                .finally(() => setFollowBusy(false));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click();
            }}
            className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-display font-black text-[11px]"
            style={{ background: following ? NAVY : '#F8EBDA', color: following ? '#fff' : NAVY }}
          >
            <Users size={12} />
            {following ? 'Following' : 'Follow'}
          </span>
        </button>

        {(reviewSummary.count > 0 || story.rating != null) && (
          <div className="mt-3">
            <StarRating
              rating={reviewSummary.count > 0 ? reviewSummary.average : (story.rating ?? 0)}
              reviews={reviewSummary.count || story.reviews || 0}
            />
          </div>
        )}

        {/* At-a-glance stats */}
        <div className="mt-3 flex gap-2">
          {story.ages && <StatChip label="Ages" value={story.ages.replace('Ages ', '')} />}
          <StatChip
            label={isAudio ? 'Episodes' : 'Chapters'}
            value={inProgress ? `${released} / ${planned}` : String(planned)}
          />
          {releasedMinutes > 0 && (
            <StatChip
              label={inProgress ? 'Out now' : 'Length'}
              value={`${releasedMinutes} min`}
            />
          )}
        </div>

        {/* Primary action */}
        <button
          type="button"
          className="mt-4 w-full rounded-full py-3.5 px-5 flex items-center justify-center gap-2 font-display font-black text-white text-[15px] active:scale-[0.98] transition-transform shadow-[0_4px_14px_rgba(23,58,94,0.3)]"
          style={{ background: NAVY }}
        >
          {isAudio ? <Play size={18} className="fill-white" /> : <BookOpen size={18} />}
          {isAudio ? 'Listen Now' : 'Read Now'}
        </button>

        {inProgress ? (
          /* Pledge card — buying the unfinished series in advance */
          <section
            className="mt-3 rounded-[1.35rem] px-4 py-4"
            style={{ background: '#F8EBDA' }}
          >
            <div className="flex items-center gap-1.5">
              <Hammer size={14} className="text-[#E8890C]" />
              <h2 className="font-display font-black text-sm" style={{ color: NAVY }}>
                Still being written
              </h2>
            </div>
            <p className="mt-1 font-display text-[12px] leading-snug" style={{ color: MUTED }}>
              {released} of {planned} {unit}s are out.{' '}
              {story.releasePlan ? `${story.releasePlan}.` : ''} Pledge now and every new{' '}
              {unit} unlocks for you the day it lands.
            </p>

            {/* Release progress */}
            <div className="mt-3 h-2 rounded-full bg-white/70 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${releaseProgress}%`,
                  background: '#E8890C',
                }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="font-display text-[11px] font-bold" style={{ color: NAVY }}>
                {releaseProgress}% released
              </span>
              {backerCount > 0 && (
                <span className="font-display text-[11px]" style={{ color: MUTED }}>
                  {backerCount.toLocaleString()} backers
                </span>
              )}
            </div>

            {pledged ? (
              <div
                className="mt-3 w-full rounded-full py-3 px-5 flex items-center justify-center gap-2 font-display font-black text-[14px] text-white"
                style={{ background: '#16a34a' }}
              >
                <Check size={16} />
                You&apos;re backing this series
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPledgeSheet(true)}
                className="mt-3 w-full rounded-full py-3 px-5 flex items-center justify-center gap-2 font-display font-black text-[14px] bg-white active:scale-[0.98] transition-transform shadow-[0_2px_8px_rgba(23,58,94,0.08)]"
                style={{ color: NAVY }}
              >
                <img src={COIN} alt="" className="w-4 h-4" />
                Pledge {story.credits} Credit{story.credits === 1 ? '' : 's'} for the full series
              </button>
            )}

            <p className="mt-2 font-display text-[10px] text-center leading-snug" style={{ color: MUTED }}>
              {pledged
                ? `We'll let you know the moment the next ${unit} is ready.`
                : 'One price for the whole series — the price never goes up later.'}
            </p>
            <button
              type="button"
              onClick={() => setShowCreditPacks(true)}
              className="mt-2 w-full font-display font-bold text-[12px]"
              style={{ color: NAVY }}
            >
              Need credits? Buy a pack
            </button>
          </section>
        ) : (
          <>
            <button
              type="button"
              className="mt-2.5 w-full rounded-full py-3 px-5 flex items-center justify-center gap-2 font-display font-black text-[14px] bg-white active:scale-[0.98] transition-transform shadow-[0_2px_8px_rgba(23,58,94,0.08)]"
              style={{ color: NAVY }}
            >
              <img src={COIN} alt="" className="w-4 h-4" />
              Unlock all for {story.credits} Credit{story.credits === 1 ? '' : 's'}
            </button>

            {hasFreePreview && (
              <p className="mt-2 font-display text-[11px] text-center" style={{ color: MUTED }}>
                First {unit} is free — credits unlock the rest.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowCreditPacks(true)}
              className="mt-2 w-full font-display font-bold text-[12px]"
              style={{ color: NAVY }}
            >
              Need credits? Buy a pack
            </button>
          </>
        )}

        {/* Blurb */}
        {story.blurb && (
          <section className="mt-6">
            <h2 className="font-display font-black text-base" style={{ color: NAVY }}>
              About this story
            </h2>
            <p className="mt-1.5 font-display text-[13px] leading-relaxed" style={{ color: '#5B7A9A' }}>
              {story.blurb}
            </p>
          </section>
        )}

        {/* Episode / chapter list */}
        <section className="mt-6">
          <h2 className="font-display font-black text-base mb-3" style={{ color: NAVY }}>
            {isAudio ? 'Episodes' : 'Chapters'}
          </h2>
          <div className="space-y-2">
            {story.episodeList.map((episode, index) => {
              const meta = episodeMeta(episode, pledged);
              const thumb = episode.coverImage || story.cover;
              return (
              <button
                key={`${index}-${episode.title}`}
                type="button"
                disabled={episode.planned}
                className={`w-full flex items-center gap-3 rounded-[1.1rem] px-3 py-2.5 text-left transition-transform ${
                  episode.planned
                    ? 'bg-white/60 border border-dashed border-[#d8c7ad]'
                    : 'bg-white shadow-[0_2px_8px_rgba(23,58,94,0.06)] active:scale-[0.99]'
                }`}
              >
                <span className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#ead9c4]">
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    {episode.planned ? (
                      <Clock size={14} className="text-white" />
                    ) : episode.free ? (
                      isAudio ? (
                        <Play size={14} className="text-white fill-white ml-0.5" />
                      ) : (
                        <BookOpen size={14} className="text-white" />
                      )
                    ) : (
                      <Lock size={14} className="text-white" />
                    )}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-display font-bold text-[13px] leading-snug truncate"
                    style={{ color: episode.planned ? 'rgba(23,58,94,0.6)' : NAVY }}
                  >
                    {index + 1}. {episode.title}
                  </p>
                  {meta && (
                    <p className="font-display text-[11px] mt-0.5" style={{ color: MUTED }}>
                      {meta}
                    </p>
                  )}
                </div>
                {episode.planned && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-display font-black text-[10px]"
                    style={{ background: '#FBE3C4', color: '#8A5A12' }}
                  >
                    Planned
                  </span>
                )}
              </button>
              );
            })}
          </div>
        </section>

        {/* More from this creator */}
        {moreFromCreator.length > 0 && (
          <section className="mt-6">
            <h2 className="font-display font-black text-base mb-3" style={{ color: NAVY }}>
              More from {story.creator}
            </h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              {moreFromCreator.map((other) => (
                <MoreCard
                  key={other.id}
                  story={other}
                  onOpen={() => navigate(`/creators/story/${other.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Family ratings — separate from the team safety check below */}
        <section className="mt-6 rounded-[1.35rem] bg-white px-4 py-4 shadow-[0_2px_8px_rgba(23,58,94,0.06)]">
          <h2 className="font-display font-black text-base" style={{ color: NAVY }}>
            Family reviews
          </h2>
          <p className="mt-1 font-display text-[12px]" style={{ color: MUTED }}>
            Parents can leave a kind star rating. A note is optional — if you add one, make it
            specific, kid-friendly, and free of slang or swearing.
          </p>
          {reviewSummary.count > 0 && (
            <div className="mt-2">
              <StarRating rating={reviewSummary.average} reviews={reviewSummary.count} />
            </div>
          )}
          <div className="mt-3 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1} stars`}
                onClick={() => setMyRating(i + 1)}
              >
                <Star
                  size={22}
                  className={i < myRating ? 'fill-[#E8B923] text-[#E8B923]' : 'text-[#D4C4B0]'}
                />
              </button>
            ))}
          </div>
          <textarea
            value={myComment}
            onChange={(event) => setMyComment(event.target.value.slice(0, 280))}
            placeholder="What did your child like or learn? (optional)"
            className="mt-3 w-full rounded-[1rem] px-3 py-2 font-display text-[13px] outline-none"
            style={{ background: '#F8EBDA', color: NAVY, minHeight: '4.5rem' }}
          />
          <button
            type="button"
            disabled={reviewBusy || myRating < 1}
            onClick={() => {
              if (myRating < 1) return;
              setReviewBusy(true);
              setReviewMessage(null);
              setReviewTone(null);
              void hubService
                .saveReview(story.id, myRating, myComment)
                .then((data) => {
                  setReviews(data.reviews);
                  setReviewSummary({ average: data.averageRating, count: data.ratingCount });
                  const pending = data.status === 'pending' || data.myReview?.status === 'pending';
                  setMyReviewPending(pending);
                  setReviewTone('ok');
                  setReviewMessage(data.message || 'Saved — thank you!');
                })
                .catch((error: Error) => {
                  setReviewTone('err');
                  setReviewMessage(error.message);
                })
                .finally(() => setReviewBusy(false));
            }}
            className="mt-3 w-full rounded-full py-2.5 font-display font-black text-sm text-white disabled:opacity-50"
            style={{ background: NAVY }}
          >
            {reviewBusy ? 'Saving…' : 'Save my review'}
          </button>
          {reviewMessage && (
            <p
              className="mt-2 font-display text-[12px] leading-snug"
              style={{ color: reviewTone === 'err' ? '#b45309' : MUTED }}
            >
              {reviewMessage}
            </p>
          )}
          {myReviewPending && !reviewMessage && (
            <p className="mt-1 font-display text-[12px] leading-snug" style={{ color: MUTED }}>
              Your note is waiting for a quick look before families can see it.
            </p>
          )}
          {reviews.length > 0 && (
            <ul className="mt-4 space-y-3">
              {reviews.slice(0, 8).map((review) => (
                <li key={review.id} className="border-t border-[#ead9c4] pt-3">
                  <p className="font-display font-bold text-[12px]" style={{ color: NAVY }}>
                    {review.displayName}
                    {review.mine ? ' (you)' : ''}
                  </p>
                  <StarRating rating={review.rating} reviews={0} />
                  {review.comment && (
                    <p className="mt-1 font-display text-[12px] leading-snug" style={{ color: MUTED }}>
                      {review.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Safety reassurance for parents */}
        <section
          className="mt-6 rounded-[1.35rem] px-4 py-3.5 flex items-center gap-2.5"
          style={{ background: '#F8EBDA' }}
        >
          <Shield size={18} className="text-[#16a34a] shrink-0" />
          <p className="font-display text-[11px] leading-snug" style={{ color: MUTED }}>
            Reviewed by our team for kid-safe language, art, and faith content.
          </p>
        </section>
      </div>

      {showCreditPacks && (
        <CreditPackSheet onClose={() => setShowCreditPacks(false)} />
      )}

      {/* Pledge confirmation sheet — spells out what a pledge buys */}
      {showPledgeSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setShowPledgeSheet(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div
            className="relative w-full max-w-md rounded-t-[1.75rem] px-5 pt-5"
            style={{
              background: CREAM,
              paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 1.25rem)',
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#F8EBDA' }}
              >
                <Hammer size={18} className="text-[#E8890C]" />
              </span>
              <h2 className="font-display font-black text-[1.05rem]" style={{ color: NAVY }}>
                Back this series
              </h2>
            </div>

            <p className="mt-3 font-display text-[13px] leading-relaxed" style={{ color: '#5B7A9A' }}>
              {story.creator} is still making <strong>{story.title}</strong>. Your pledge is a
              nudge to keep going — and it locks in the whole series at today&apos;s price.
            </p>

            <ul className="mt-3 space-y-2">
              {[
                `Unlock all ${released} ${unit}${released === 1 ? '' : 's'} out right now`,
                `Every new ${unit} appears in your library free`,
                story.releasePlan ?? 'New parts arrive as the creator finishes them',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check size={14} className="text-[#16a34a] mt-0.5 shrink-0" />
                  <span className="font-display text-[12px] leading-snug" style={{ color: NAVY }}>
                    {line}
                  </span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => {
                setPledged(true);
                setShowPledgeSheet(false);
              }}
              className="mt-4 w-full rounded-full py-3.5 px-5 flex items-center justify-center gap-2 font-display font-black text-white text-[15px] active:scale-[0.98] transition-transform shadow-[0_4px_14px_rgba(23,58,94,0.3)]"
              style={{ background: NAVY }}
            >
              <img src={COIN} alt="" className="w-4 h-4" />
              Pledge {story.credits} Credit{story.credits === 1 ? '' : 's'}
            </button>

            <button
              type="button"
              onClick={() => setShowPledgeSheet(false)}
              className="mt-2 w-full rounded-full py-2.5 font-display font-bold text-[13px]"
              style={{ color: MUTED }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorStoryDetailPage;
