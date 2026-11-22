import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Users } from 'lucide-react';
import { hubService } from '../services/hubService';
import type { CreatorFeedPost, CreatorSocialNote } from '../services/hubService';
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
  const [posts, setPosts] = useState<CreatorFeedPost[]>([]);
  const [wall, setWall] = useState<CreatorSocialNote[]>([]);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followMessage, setFollowMessage] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, CreatorSocialNote[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentBusy, setCommentBusy] = useState<string | null>(null);
  const [likeBusy, setLikeBusy] = useState<string | null>(null);
  const [wallDraft, setWallDraft] = useState('');
  const [wallBusy, setWallBusy] = useState(false);
  const [socialMessage, setSocialMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!creatorId) {
      setStatus('missing');
      return;
    }
    setStatus('loading');
    try {
      const [result, feed, notes] = await Promise.all([
        hubService.getCreator(creatorId),
        hubService.getCreatorPosts(creatorId).catch(() => []),
        hubService.getCreatorWall(creatorId).catch(() => []),
      ]);
      if (!result) {
        setStatus('missing');
        return;
      }
      setProfile(result.profile);
      setStories(result.stories);
      setFollowing(result.following);
      setPosts(feed);
      setWall(notes);
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

  const toggleLike = async (post: CreatorFeedPost) => {
    if (likeBusy) return;
    setLikeBusy(post.id);
    setSocialMessage(null);
    try {
      const result = await hubService.togglePostLike(post.id);
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, likedByMe: result.likedByMe, likeCount: result.likeCount }
            : item,
        ),
      );
    } catch (error) {
      setSocialMessage(error instanceof Error ? error.message : 'Could not update like');
    } finally {
      setLikeBusy(null);
    }
  };

  const loadComments = async (postId: string) => {
    if (openComments[postId]) {
      setOpenComments((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
      return;
    }
    try {
      const comments = await hubService.getPostComments(postId);
      setOpenComments((current) => ({ ...current, [postId]: comments }));
    } catch (error) {
      setSocialMessage(error instanceof Error ? error.message : 'Could not load comments');
    }
  };

  const submitComment = async (postId: string) => {
    const draft = (commentDrafts[postId] || '').trim();
    if (!draft || commentBusy) return;
    setCommentBusy(postId);
    setSocialMessage(null);
    try {
      const result = await hubService.addPostComment(postId, draft);
      setCommentDrafts((current) => ({ ...current, [postId]: '' }));
      if (result.message) setSocialMessage(result.message);
      if (result.comment) {
        setOpenComments((current) => ({
          ...current,
          [postId]: [result.comment!, ...(current[postId] || [])],
        }));
        setPosts((current) =>
          current.map((item) =>
            item.id === postId ? { ...item, commentCount: item.commentCount + 1 } : item,
          ),
        );
      }
    } catch (error) {
      setSocialMessage(error instanceof Error ? error.message : 'Could not save comment');
    } finally {
      setCommentBusy(null);
    }
  };

  const submitWall = async () => {
    if (!creatorId || !wallDraft.trim() || wallBusy) return;
    setWallBusy(true);
    setSocialMessage(null);
    try {
      const result = await hubService.addWallNote(creatorId, wallDraft.trim());
      setWallDraft('');
      if (result.message) setSocialMessage(result.message);
      if (result.note) setWall((current) => [result.note!, ...current]);
    } catch (error) {
      setSocialMessage(error instanceof Error ? error.message : 'Could not save note');
    } finally {
      setWallBusy(false);
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

        {socialMessage && (
          <p className="mt-4 text-center font-display text-[12px]" style={{ color: MUTED }}>
            {socialMessage}
          </p>
        )}

        <section className="mt-8">
          <h2 className="font-display font-black text-base mb-3" style={{ color: NAVY }}>
            Updates
          </h2>
          <div className="space-y-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-[1.1rem] bg-white px-3 py-3 shadow-[0_2px_8px_rgba(23,58,94,0.06)]"
              >
                {post.body && (
                  <p className="font-display text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: NAVY }}>
                    {post.body}
                  </p>
                )}
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" className="mt-2 w-full max-h-56 rounded-xl object-cover" />
                )}
                <div className="mt-2 flex items-center gap-4">
                  <button
                    type="button"
                    disabled={likeBusy === post.id}
                    onClick={() => void toggleLike(post)}
                    className="inline-flex items-center gap-1 font-display text-[12px] disabled:opacity-60"
                    style={{ color: post.likedByMe ? '#dc2626' : MUTED }}
                  >
                    <Heart size={14} fill={post.likedByMe ? '#dc2626' : 'none'} />
                    {post.likeCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadComments(post.id)}
                    className="inline-flex items-center gap-1 font-display text-[12px]"
                    style={{ color: MUTED }}
                  >
                    <MessageCircle size={14} />
                    {post.commentCount}
                  </button>
                </div>
                {openComments[post.id] && (
                  <div className="mt-3 border-t border-[#ead9c4] pt-3 space-y-2">
                    {openComments[post.id].map((comment) => (
                      <div key={comment.id}>
                        <p className="font-display font-bold text-[11px]" style={{ color: NAVY }}>
                          {comment.displayName}
                        </p>
                        <p className="font-display text-[12px]" style={{ color: '#5B7A9A' }}>
                          {comment.body}
                        </p>
                      </div>
                    ))}
                    {openComments[post.id].length === 0 && (
                      <p className="font-display text-[12px]" style={{ color: MUTED }}>
                        Be the first to leave a kind note.
                      </p>
                    )}
                    <textarea
                      value={commentDrafts[post.id] || ''}
                      onChange={(e) =>
                        setCommentDrafts((current) => ({ ...current, [post.id]: e.target.value.slice(0, 280) }))
                      }
                      rows={2}
                      placeholder="A short, kind note..."
                      className="w-full rounded-xl border border-[#ead9c4] bg-[#fffaf3] px-3 py-2 font-display text-[12px]"
                      style={{ color: NAVY }}
                    />
                    <button
                      type="button"
                      disabled={commentBusy === post.id || !(commentDrafts[post.id] || '').trim()}
                      onClick={() => void submitComment(post.id)}
                      className="rounded-full px-4 py-1.5 font-display font-black text-xs text-white disabled:opacity-50"
                      style={{ background: NAVY }}
                    >
                      {commentBusy === post.id ? 'Sending...' : 'Comment'}
                    </button>
                  </div>
                )}
              </article>
            ))}
            {posts.length === 0 && (
              <p className="font-display text-[13px]" style={{ color: MUTED }}>
                No updates yet.
              </p>
            )}
          </div>
        </section>

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

        <section className="mt-8">
          <h2 className="font-display font-black text-base mb-3" style={{ color: NAVY }}>
            Profile wall
          </h2>
          <textarea
            value={wallDraft}
            onChange={(e) => setWallDraft(e.target.value.slice(0, 280))}
            rows={3}
            placeholder="Write a kind note for this creator..."
            className="w-full rounded-[1.1rem] border border-[#ead9c4] bg-white px-3 py-2 font-display text-[13px]"
            style={{ color: NAVY }}
          />
          <button
            type="button"
            disabled={wallBusy || !wallDraft.trim()}
            onClick={() => void submitWall()}
            className="mt-2 rounded-full px-5 py-2 font-display font-black text-sm text-white disabled:opacity-50"
            style={{ background: NAVY }}
          >
            {wallBusy ? 'Sending...' : 'Post to wall'}
          </button>
          <div className="mt-4 space-y-2">
            {wall.map((note) => (
              <div
                key={note.id}
                className="rounded-[1.1rem] bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(23,58,94,0.06)]"
              >
                <p className="font-display font-bold text-[11px]" style={{ color: NAVY }}>
                  {note.displayName}
                </p>
                <p className="font-display text-[13px]" style={{ color: '#5B7A9A' }}>
                  {note.body}
                </p>
              </div>
            ))}
            {wall.length === 0 && (
              <p className="font-display text-[13px]" style={{ color: MUTED }}>
                No wall notes yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CreatorPublicProfilePage;
