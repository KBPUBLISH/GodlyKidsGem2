import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Filter,
  Hammer,
  Headphones,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Shield,
  Star,
} from 'lucide-react';
import { FEATURE_CREATE_YOUR_STORY } from '../../constants';
import { hubService, toCreatorProfiles } from '../../services/hubService';
import {
  plannedCount,
  releasedCount,
  type CreatorProfile,
  type CreatorStory,
  type StoryFormat,
} from '../../utils/creatorStories';

/** One browse call feeds every shelf, the creator row and the search box. */
const CATALOG_LIMIT = 60;
const ROW_LIMIT = 12;

const NAVY = '#173A5E';
const SEE_ALL = '#8B5A2B';
const CARD_BG = '#FFFFFF';
const MUTED = '#8A7A68';
const COIN = '/assets/ui/coin.png';

const SectionHeader = ({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) => (
  <div className="flex items-center justify-between mb-3 px-0.5">
    <h3 className="font-display font-black text-base" style={{ color: NAVY }}>
      {title}
    </h3>
    {onSeeAll && (
      <button
        type="button"
        onClick={onSeeAll}
        className="font-display font-bold text-xs"
        style={{ color: SEE_ALL }}
      >
        See All
      </button>
    )}
  </div>
);

const StarRating = ({ rating, reviews }: { rating: number; reviews: number }) => (
  <div className="flex items-center gap-1 mt-1">
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={11}
          className={i < Math.round(rating) ? 'fill-[#E8B923] text-[#E8B923]' : 'text-[#D4C4B0]'}
        />
      ))}
    </div>
    <span className="font-display text-[11px] font-bold" style={{ color: NAVY }}>
      {rating.toFixed(1)}
    </span>
    <span className="font-display text-[11px]" style={{ color: MUTED }}>
      ({reviews})
    </span>
  </div>
);

const FormatBadge = ({ format }: { format: StoryFormat }) => (
  <span
    className={`absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display font-black text-[10px] text-white shadow-md ${
      format === 'audio' ? 'bg-[#2563eb]' : 'bg-[#16a34a]'
    }`}
  >
    {format === 'audio' ? <Headphones size={10} /> : <BookOpen size={10} />}
    {format === 'audio' ? 'Audio' : 'Read'}
  </span>
);

const StoryCard: React.FC<{
  story: CreatorStory;
  compact?: boolean;
  onOpen: () => void;
}> = ({ story, compact = false, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className={`shrink-0 text-left rounded-[1.25rem] overflow-hidden shadow-[0_2px_10px_rgba(23,58,94,0.08)] active:scale-[0.98] transition-transform ${
      compact ? 'w-[10.5rem]' : 'w-[12.5rem]'
    }`}
    style={{ background: CARD_BG }}
  >
    <div className="relative w-full aspect-video overflow-hidden bg-[#ead9c4]">
      <img src={story.cover} alt="" className="w-full h-full object-cover" />
      <div
        className={`absolute top-1.5 left-1.5 rounded-full overflow-hidden border-2 border-white shadow-md bg-[#ead9c4] ${
          compact ? 'w-11 h-11' : 'w-12 h-12'
        }`}
      >
        <img src={story.creatorAvatar} alt="" className="w-full h-full object-cover" />
      </div>
      <FormatBadge format={story.format} />
      {story.seriesStatus === 'in-progress' && (
        <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display font-black text-[10px] text-white shadow-md bg-[#E8890C]">
          <Hammer size={10} />
          In Progress
        </span>
      )}
    </div>
    <div className={`px-2.5 ${compact ? 'pt-2 pb-2.5' : 'pt-2.5 pb-3'}`}>
      <p
        className={`font-display font-black leading-snug line-clamp-2 ${compact ? 'text-[12px]' : 'text-[13px]'}`}
        style={{ color: NAVY }}
      >
        {story.title}
      </p>
      <p className="font-display text-[10px] mt-0.5 truncate" style={{ color: '#5B7A9A' }}>
        by {story.creator}
      </p>
      {!compact && story.rating != null && (
        <StarRating rating={story.rating} reviews={story.reviews ?? 0} />
      )}
      <p className="font-display text-[10px] mt-0.5" style={{ color: MUTED }}>
        {[
          story.ages,
          story.seriesStatus === 'in-progress'
            ? `${releasedCount(story)} of ${plannedCount(story)} out`
            : `${plannedCount(story)} episode${plannedCount(story) === 1 ? '' : 's'}`,
        ]
          .filter(Boolean)
          .join(' • ')}
      </p>
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="w-7 h-7 rounded-full bg-[#173A5E] flex items-center justify-center shrink-0">
          <Play size={12} className="text-white fill-white ml-0.5" />
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-display font-black text-[10px]"
          style={{ background: '#F8EBDA', color: NAVY }}
        >
          <img src={COIN} alt="" className="w-3.5 h-3.5" />
          {story.seriesStatus === 'in-progress' ? 'Pledge ' : ''}
          {story.credits} Credit{story.credits === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  </button>
);

const CreatorRow: React.FC<{ creator: CreatorProfile; onOpen: () => void }> = ({ creator, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="shrink-0 flex items-center gap-3 w-[12.5rem] rounded-[1.1rem] bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(23,58,94,0.06)] active:scale-[0.98] transition-transform text-left"
  >
    <div className="w-16 h-16 rounded-full overflow-hidden bg-[#ead9c4] shrink-0">
      <img src={creator.avatar} alt="" className="w-full h-full object-cover" />
    </div>
    <div className="min-w-0">
      <p className="font-display font-black text-[13px] leading-snug truncate" style={{ color: NAVY }}>
        {creator.name}
      </p>
      <p className="font-display text-[11px] mt-0.5" style={{ color: MUTED }}>
        {creator.storyCount} Stories
      </p>
    </div>
  </button>
);

const CreatorsDiscoverPanel: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [catalog, setCatalog] = useState<CreatorStory[]>([]);
  const [featured, setFeatured] = useState<CreatorStory[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [browse, featuredStories] = await Promise.all([
        hubService.browseSeries({ sort: 'newest', limit: CATALOG_LIMIT }),
        // A curated shelf is a bonus — if it fails the tab is still browsable.
        hubService.getFeaturedSeries().catch(() => [] as CreatorStory[]),
      ]);
      setCatalog(browse.stories);
      setFeatured(featuredStories);
      setStatus('ready');
    } catch (error) {
      console.warn('Failed to load creator stories:', error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openStory = (story: CreatorStory) => navigate(`/creators/story/${story.id}`);

  const filterStories = useCallback(
    (stories: CreatorStory[]) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return stories;
      return stories.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.creator.toLowerCase().includes(q),
      );
    },
    [searchQuery],
  );

  // Featured is the curated pick; without it, most-backed series stand in.
  const recommended = useMemo(() => {
    const source =
      featured.length > 0
        ? featured
        : [...catalog].sort((a, b) => (b.backers ?? 0) - (a.backers ?? 0));
    return filterStories(source.slice(0, ROW_LIMIT));
  }, [catalog, featured, filterStories]);

  // The browse call is sorted newest-first by the API.
  const newReleases = useMemo(
    () => filterStories(catalog.slice(0, ROW_LIMIT)),
    [catalog, filterStories],
  );

  const creators = useMemo(() => {
    const profiles = toCreatorProfiles(catalog);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((c) => c.name.toLowerCase().includes(q));
  }, [catalog, searchQuery]);

  const retry = async () => {
    setIsRetrying(true);
    await load();
    setIsRetrying(false);
  };

  return (
    <div className="pb-4">
      {/* Search + filters — only useful once there is a catalog to search */}
      {status === 'ready' && catalog.length > 0 && (
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'rgba(23,58,94,0.45)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stories, creators..."
            className="w-full bg-white border-2 border-[#eee3cd] rounded-xl py-2.5 pl-9 pr-3 font-display text-sm text-[#173A5E] placeholder:text-[#173A5E]/45 shadow-[0_2px_6px_rgba(122,90,44,0.06)] focus:outline-none focus:border-[#2563eb]/40"
          />
        </div>
        <button
          type="button"
          className="shrink-0 inline-flex items-center gap-1.5 bg-white border-2 border-[#eee3cd] rounded-xl px-3 py-2.5 font-display font-bold text-xs shadow-[0_2px_6px_rgba(122,90,44,0.06)]"
          style={{ color: NAVY }}
        >
          <Filter size={14} />
          Filters
        </button>
      </div>
      )}

      {status === 'loading' ? (
        <div className="font-display text-center py-10 font-bold" style={{ color: NAVY }}>
          Loading creator stories...
        </div>
      ) : status === 'error' ? (
        <div className="text-center py-10 px-4 rounded-2xl bg-white/80">
          <p className="font-display font-black text-sm" style={{ color: NAVY }}>
            The story shelf drifted off!
          </p>
          <p className="mt-1 font-display text-[12px]" style={{ color: MUTED }}>
            We couldn&apos;t reach the creators right now.
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={isRetrying}
            className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-display font-black text-sm text-white active:scale-[0.97] transition-transform disabled:opacity-60"
            style={{ background: NAVY }}
          >
            <RefreshCw size={15} className={isRetrying ? 'animate-spin' : undefined} />
            {isRetrying ? 'Trying...' : 'Try Again'}
          </button>
        </div>
      ) : catalog.length === 0 ? (
        <div
          className="font-display text-center py-10 px-4 rounded-2xl bg-white/80 text-sm"
          style={{ color: MUTED }}
        >
          No creator stories yet — new ones land here as creators publish them.
        </div>
      ) : (
      <>
      {/* Recommended for You */}
      {recommended.length > 0 && (
        <section className="mb-6">
          <SectionHeader title="Recommended for You" />
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {recommended.map((story) => (
              <StoryCard key={story.id} story={story} onOpen={() => openStory(story)} />
            ))}
          </div>
        </section>
      )}

      {/* Popular Creators */}
      {creators.length > 0 && (
        <section className="mb-6">
          <SectionHeader title="Popular Creators" />
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {creators.map((creator) => (
              <CreatorRow
                key={creator.id}
                creator={creator}
                onOpen={() => navigate(`/creators/${creator.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* New Releases */}
      {newReleases.length > 0 && (
        <section className="mb-6">
          <SectionHeader title="New Releases" />
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {newReleases.map((story) => (
              <StoryCard key={story.id} story={story} compact onOpen={() => openStory(story)} />
            ))}
          </div>
        </section>
      )}

      {recommended.length === 0 && creators.length === 0 && newReleases.length === 0 && (
        <div className="font-display text-center py-10 px-4 rounded-2xl bg-white/80 text-sm" style={{ color: MUTED }}>
          No matching stories or creators found.
        </div>
      )}
      </>
      )}

      {/* Safe & Screen-Free banner */}
      <section
        className="mb-5 rounded-[1.35rem] px-4 py-4 flex items-center gap-3"
        style={{ background: '#F8EBDA' }}
      >
        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#ead9c4] shrink-0">
          <img
            src="/assets/images/creators-hero.jpg"
            alt=""
            className="w-full h-full object-cover object-[70%_center]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Shield size={14} className="text-[#16a34a]" />
            <h3 className="font-display font-black text-sm" style={{ color: NAVY }}>
              Safe &amp; Screen-Free
            </h3>
          </div>
          <p className="font-display text-[11px] leading-snug mt-0.5" style={{ color: MUTED }}>
            Hand-picked stories that build faith, character, and imagination.
          </p>
        </div>
      </section>

      {/* Create Your Story CTA */}
      {FEATURE_CREATE_YOUR_STORY && (
        <section className="rounded-[1.35rem] px-5 py-5 bg-white shadow-[0_2px_10px_rgba(23,58,94,0.06)]">
          <h3 className="font-display font-black text-[1.05rem] leading-snug" style={{ color: NAVY }}>
            Have a story to share?
          </h3>
          <p className="mt-1 font-display text-[13px] leading-snug" style={{ color: MUTED }}>
            Join our community of creators and inspire kids around the world.
          </p>
          <button
            type="button"
            onClick={() => navigate('/create-your-story')}
            className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-display font-black text-sm text-white active:scale-[0.97] transition-transform"
            style={{ background: NAVY }}
          >
            <Pencil size={15} />
            Create Your Story
          </button>
        </section>
      )}
    </div>
  );
};

export default CreatorsDiscoverPanel;
