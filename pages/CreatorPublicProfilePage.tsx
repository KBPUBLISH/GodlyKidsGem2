import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { hubService } from '../services/hubService';
import type { CreatorProfile, CreatorStory } from '../utils/creatorStories';

const NAVY = '#173A5E';
const CREAM = '#F7F0E6';
const MUTED = '#8A7A68';

const CreatorPublicProfilePage: React.FC = () => {
  const { creatorId } = useParams<{ creatorId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [stories, setStories] = useState<CreatorStory[]>([]);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followMessage, setFollowMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!creatorId) {
      setStatus('missing');
      return;
    }
    setStatus('loading');
    try {
      const result = await hubService.getCreator(creatorId);
      if (!result) {
        setStatus('missing');
        return;
      }
      setProfile(result.profile);
      setStories(result.stories);
      setFollowing(result.following);
      setStatus('ready');
    } catch (error) {
      console.warn('Failed to load creator profile:', error);
      setStatus('error');
    }
  }, [creatorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = async () => {
    if (!creatorId || followBusy) return;
    setFollowBusy(true);
    setFollowMessage(null);
    try {
      const next = await hubService.followCreator(creatorId, !following);
      setFollowing(next);
    } catch (error) {
      setFollowMessage(error instanceof Error ? error.message : 'Could not update follow');
    } finally {
      setFollowBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="h-full flex items-center justify-center font-display font-bold" style={{ background: CREAM, color: NAVY }}>
        Loading creator...
      </div>
    );
  }

  if (status !== 'ready' || !profile) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center" style={{ background: CREAM }}>
        <p className="font-display font-bold" style={{ color: NAVY }}>
          {status === 'error' ? 'We could not reach this creator.' : 'This creator is not available.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/listen', { state: { libraryMode: 'creators' } })}
          className="mt-4 rounded-full px-5 py-2.5 font-display font-black text-sm text-white"
          style={{ background: NAVY }}
        >
          Back to Creators
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar" style={{ background: CREAM }}>
      <div
        className="px-4 pt-4"
        style={{
          paddingTop: 'max(16px, calc(var(--safe-area-top, 0px) + 12px))',
          paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 2rem)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-10 h-10 rounded-full bg-white shadow-[0_2px_8px_rgba(8,22,44,0.12)] flex items-center justify-center"
        >
          <ArrowLeft size={20} style={{ color: NAVY }} />
        </button>

        <div className="mt-4 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-[#ead9c4]">
            <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
          </div>
          <h1 className="mt-3 font-display font-black text-[1.4rem]" style={{ color: NAVY }}>
            {profile.name}
          </h1>
          <p className="font-display text-[12px]" style={{ color: MUTED }}>
            {profile.storyCount} {profile.storyCount === 1 ? 'story' : 'stories'}
          </p>
          {profile.bio && (
            <p className="mt-3 max-w-sm font-display text-[13px] leading-relaxed" style={{ color: '#5B7A9A' }}>
              {profile.bio}
            </p>
          )}
          <button
            type="button"
            disabled={followBusy}
            onClick={() => void toggleFollow()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 font-display font-black text-sm text-white disabled:opacity-60"
            style={{ background: following ? '#16a34a' : NAVY }}
          >
            <Users size={14} />
            {following ? 'Following' : 'Follow'}
          </button>
          {followMessage && (
            <p className="mt-2 font-display text-[12px]" style={{ color: MUTED }}>
              {followMessage}
            </p>
          )}
        </div>

        <section className="mt-8">
          <h2 className="font-display font-black text-base mb-3" style={{ color: NAVY }}>
            Series
          </h2>
          <div className="space-y-2">
            {stories.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => navigate(`/creators/story/${story.id}`)}
                className="w-full flex items-center gap-3 rounded-[1.1rem] bg-white px-3 py-2.5 text-left shadow-[0_2px_8px_rgba(23,58,94,0.06)]"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#ead9c4] shrink-0">
                  <img src={story.cover} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-black text-[13px] truncate" style={{ color: NAVY }}>
                    {story.title}
                  </p>
                  <p className="font-display text-[11px]" style={{ color: MUTED }}>
                    {story.credits} credits
                    {story.rating != null ? ` • ${story.rating.toFixed(1)} stars` : ''}
                  </p>
                </div>
              </button>
            ))}
            {stories.length === 0 && (
              <p className="font-display text-[13px]" style={{ color: MUTED }}>
                No published series yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CreatorPublicProfilePage;
