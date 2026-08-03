import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Music,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  Square,
  X,
} from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';
import TapFillCanvas, { TapFillCanvasHandle } from '../components/features/TapFillCanvas';
import DrawingCanvas from '../components/features/DrawingCanvas';
import CoverImage from '../components/ui/CoverImage';
import { useAudio, type AudioItem, type Playlist } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import {
  buildIslandSceneNavState,
  buildIslandScenePath,
} from '../utils/islandSceneReturn';
import {
  DEFAULT_COLORING_PALETTE,
  getColorSwatchStyle,
} from '../utils/coloringPalette';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';

const DEFAULT_PALETTE: string[] = [...DEFAULT_COLORING_PALETTE];

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

const getBibleMapApiRoot = (): string => {
  const base = (getApiBaseUrl() || '').replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
};

const resolveMediaUrl = (url: string | undefined | null): string => {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/assets/')
  ) {
    return trimmed;
  }
  const base = getApiBaseUrl().replace(/\/$/, '');
  const origin = base.replace(/\/api$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
};

/** Merge CMS palette with defaults so newer colors (incl. metallics) always appear. */
const mergePalette = (cms?: string[] | null): string[] => {
  if (!cms || cms.length === 0) return DEFAULT_PALETTE;
  const seen = new Set(cms.map((c) => c.trim().toUpperCase()));
  const extras = DEFAULT_PALETTE.filter((c) => !seen.has(c.toUpperCase()));
  return [...cms, ...extras];
};

type TapFillCms = {
  enabled?: boolean;
  regionMapUrl?: string;
  regionPreviewUrl?: string;
  regionCount?: number;
  palette?: string[];
};

type ColoringPageCms = {
  _id?: string;
  pageNumber?: number;
  backgroundUrl?: string;
  files?: { background?: { url?: string } };
  tapFill?: TapFillCms;
};

type StoryCms = {
  _id?: string;
  title?: string;
  displayTitle?: string;
  coloringPageIds?: ColoringPageCms[] | string[];
};

type Phase = 'loading' | 'ready' | 'missing';

/**
 * Island tap-to-fill coloring (falls back to freehand DrawingCanvas if no region map).
 * Route: /sail/:islandId/lesson/coloring
 */
const IslandColoringPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { islandId = 'genesis' } = useParams<{ islandId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const canvasRef = useRef<TapFillCanvasHandle>(null);
  const navState = location.state as {
    title?: string;
    fromMainMap?: boolean;
    fromSail?: boolean;
  } | null;

  const { isSubscribed } = useUser();
  const {
    playPlaylist,
    togglePlayPause,
    toggleShuffle,
    closePlayer,
    currentPlaylist,
    currentTrackIndex,
    isPlaying,
    isShuffle,
  } = useAudio();

  const [phase, setPhase] = useState<Phase>('loading');
  const [title, setTitle] = useState('COLORING');
  const [pages, setPages] = useState<ColoringPageCms[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [color, setColor] = useState(DEFAULT_PALETTE[0]);

  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);
  const [listenPlaylists, setListenPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  /** Full episode lists fetched on expand (keyed by playlist id). */
  const [episodesByPlaylistId, setEpisodesByPlaylistId] = useState<
    Record<string, AudioItem[]>
  >({});
  const [episodesLoadingId, setEpisodesLoadingId] = useState<string | null>(null);
  const [episodesErrorById, setEpisodesErrorById] = useState<
    Record<string, string>
  >({});

  /** Keep islandId:storyId progress key when returning to the scene. */
  const returnStoryId = searchParams.get('storyId')?.trim() || '';

  const goBack = useCallback(() => {
    const path =
      buildIslandScenePath({
        islandId,
        storyId: returnStoryId || undefined,
      }) || `/sail/${islandId}/lesson`;
    navigate(path, {
      state: buildIslandSceneNavState({
        islandId,
        storyId: returnStoryId || undefined,
        fromMainMap: Boolean(navState?.fromMainMap),
        fromSail: Boolean(navState?.fromSail),
        title: navState?.title || title,
      }),
    });
  }, [navigate, islandId, returnStoryId, navState, title]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch(
          `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(islandId)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('Island not found');
        const data = (await res.json()) as { stories?: StoryCms[] };
        const stories = Array.isArray(data.stories) ? data.stories : [];
        const storyId = searchParams.get('storyId');
        const story =
          (storyId && stories.find((s) => s._id === storyId)) ||
          stories.find(
            (s) => Array.isArray(s.coloringPageIds) && s.coloringPageIds.length > 0,
          ) ||
          stories[0];

        if (cancelled) return;

        setTitle(
          (story?.displayTitle || story?.title || 'COLORING').toUpperCase(),
        );

        const raw = Array.isArray(story?.coloringPageIds)
          ? story!.coloringPageIds!
          : [];
        const resolved: ColoringPageCms[] = raw
          .map((p) => (typeof p === 'string' ? { _id: p } : p))
          .filter((p) => p && (p.backgroundUrl || p.files?.background?.url || p.tapFill?.regionMapUrl));

        if (resolved.length === 0) {
          setPages([]);
          setPhase('missing');
          return;
        }

        setPages(resolved);
        const pageParam = searchParams.get('page');
        let idx = 0;
        if (pageParam) {
          const found = resolved.findIndex((p) => p._id === pageParam);
          if (found >= 0) idx = found;
        }
        setPageIndex(idx);
        setColor(mergePalette(resolved[idx]?.tapFill?.palette)[0]);
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('missing');
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [islandId, searchParams]);

  const fetchListenPlaylists = useCallback(async () => {
    try {
      setPlaylistsLoading(true);
      setPlaylistsError(null);
      const baseUrl = getApiBaseUrl();
      const endpoint = `${baseUrl}playlists?status=published`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        setPlaylistsError('Failed to load playlists');
        setListenPlaylists([]);
        return;
      }
      const responseData = await response.json();
      const playlistsArray = Array.isArray(responseData)
        ? responseData
        : responseData.data || [];
      const validPlaylists = playlistsArray.filter((p: Playlist & { status?: string }) => {
        return (
          p._id &&
          p.title &&
          p.status === 'published' &&
          p.items &&
          Array.isArray(p.items) &&
          p.items.length > 0
        );
      });
      setListenPlaylists(validPlaylists);
    } catch (err) {
      setPlaylistsError(
        err instanceof Error ? err.message : 'Failed to load playlists',
      );
      setListenPlaylists([]);
    } finally {
      setPlaylistsLoading(false);
    }
  }, []);

  const fetchPlaylistEpisodes = useCallback(
    async (playlistId: string): Promise<AudioItem[] | null> => {
      try {
        setEpisodesLoadingId(playlistId);
        setEpisodesErrorById((prev) => {
          if (!prev[playlistId]) return prev;
          const next = { ...prev };
          delete next[playlistId];
          return next;
        });
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}playlists/${playlistId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          throw new Error('Failed to load songs');
        }
        const data = await response.json();
        const items: AudioItem[] = Array.isArray(data?.items)
          ? [...data.items]
          : [];
        items.sort((a, b) => (a.order || 0) - (b.order || 0));
        setEpisodesByPlaylistId((prev) => ({ ...prev, [playlistId]: items }));
        setListenPlaylists((prev) =>
          prev.map((p) =>
            p._id === playlistId
              ? {
                  ...p,
                  ...data,
                  _id: p._id,
                  items: items.length > 0 ? items : p.items,
                }
              : p,
          ),
        );
        return items;
      } catch (err) {
        setEpisodesErrorById((prev) => ({
          ...prev,
          [playlistId]:
            err instanceof Error ? err.message : 'Failed to load songs',
        }));
        return null;
      } finally {
        setEpisodesLoadingId((current) =>
          current === playlistId ? null : current,
        );
      }
    },
    [],
  );

  const resolvePlaylistEpisodes = useCallback(
    async (playlist: Playlist): Promise<Playlist> => {
      const cached = episodesByPlaylistId[playlist._id];
      if (cached && cached.length > 0 && cached.some((item) => !!item.audioUrl)) {
        return { ...playlist, items: cached };
      }
      const listItems = playlist.items || [];
      if (
        listItems.length > 0 &&
        listItems.every((item) => !!item.audioUrl)
      ) {
        const sorted = [...listItems].sort(
          (a, b) => (a.order || 0) - (b.order || 0),
        );
        setEpisodesByPlaylistId((prev) =>
          prev[playlist._id] ? prev : { ...prev, [playlist._id]: sorted },
        );
        return { ...playlist, items: sorted };
      }
      const fetched = await fetchPlaylistEpisodes(playlist._id);
      if (fetched && fetched.length > 0) {
        return { ...playlist, items: fetched };
      }
      return playlist;
    },
    [episodesByPlaylistId, fetchPlaylistEpisodes],
  );

  const ensurePlaylistEpisodes = useCallback(
    (playlist: Playlist) => {
      void resolvePlaylistEpisodes(playlist);
    },
    [resolvePlaylistEpisodes],
  );

  const openPlaylistPicker = useCallback(() => {
    setShowPlaylistPicker(true);
    if (currentPlaylist?._id) {
      setSelectedPlaylistId(currentPlaylist._id);
      setExpandedPlaylistId(currentPlaylist._id);
      ensurePlaylistEpisodes(currentPlaylist);
    }
    if (listenPlaylists.length === 0) {
      void fetchListenPlaylists();
    }
  }, [
    listenPlaylists.length,
    fetchListenPlaylists,
    currentPlaylist,
    ensurePlaylistEpisodes,
  ]);

  useEffect(() => {
    if (currentPlaylist?._id) {
      setSelectedPlaylistId(currentPlaylist._id);
    }
  }, [currentPlaylist?._id]);

  const closePlaylistPicker = useCallback(() => {
    setShowPlaylistPicker(false);
  }, []);

  /** Tap album row: expand/collapse accordion (does not start playback). */
  const handleToggleAlbumExpand = useCallback(
    (playlist: Playlist) => {
      setSelectedPlaylistId(playlist._id);
      if (expandedPlaylistId === playlist._id) {
        setExpandedPlaylistId(null);
        return;
      }
      setExpandedPlaylistId(playlist._id);
      ensurePlaylistEpisodes(playlist);
    },
    [expandedPlaylistId, ensurePlaylistEpisodes],
  );

  /** Play icon on album: start album from beginning (or random if shuffle). */
  const handlePlayAlbum = useCallback(
    async (playlist: Playlist) => {
      setSelectedPlaylistId(playlist._id);
      setExpandedPlaylistId(playlist._id);
      const full = await resolvePlaylistEpisodes(playlist);
      if (!full.items?.length) return;
      const startIndex =
        isShuffle && full.items.length > 1
          ? Math.floor(Math.random() * full.items.length)
          : 0;
      playPlaylist(full, startIndex, isSubscribed);
    },
    [resolvePlaylistEpisodes, isShuffle, playPlaylist, isSubscribed],
  );

  /** Tap episode: play that track within the album playlist (next continues). */
  const handlePlayEpisode = useCallback(
    async (playlist: Playlist, episodeIndex: number) => {
      const full = await resolvePlaylistEpisodes(playlist);
      if (!full.items?.length) return;
      setSelectedPlaylistId(full._id);
      playPlaylist(full, episodeIndex, isSubscribed);
    },
    [resolvePlaylistEpisodes, playPlaylist, isSubscribed],
  );

  const handleSurprisePlaylist = useCallback(async () => {
    if (listenPlaylists.length === 0) return;
    const pick =
      listenPlaylists[Math.floor(Math.random() * listenPlaylists.length)];
    if (!pick) return;
    if (!isShuffle) {
      toggleShuffle();
    }
    setSelectedPlaylistId(pick._id);
    setExpandedPlaylistId(pick._id);
    const full = await resolvePlaylistEpisodes(pick);
    const items = full.items || [];
    if (items.length === 0) return;
    const startIndex = Math.floor(Math.random() * items.length);
    playPlaylist(full, startIndex, isSubscribed);
  }, [
    listenPlaylists,
    isShuffle,
    toggleShuffle,
    resolvePlaylistEpisodes,
    playPlaylist,
    isSubscribed,
  ]);

  const current = pages[pageIndex];
  const lineArtUrl = resolveMediaUrl(
    current?.files?.background?.url || current?.backgroundUrl,
  );
  const regionMapUrl = resolveMediaUrl(current?.tapFill?.regionMapUrl);
  // Prefer tap-fill whenever a region map exists (enabled defaults true on preprocess).
  const useTapFill = !!(
    regionMapUrl &&
    lineArtUrl &&
    current?.tapFill?.enabled !== false
  );
  const palette = useMemo(
    () => mergePalette(current?.tapFill?.palette),
    [current],
  );

  useEffect(() => {
    if (palette.length && !palette.includes(color)) {
      setColor(palette[0]);
    }
  }, [palette, color]);

  const selectPage = (idx: number) => {
    setPageIndex(idx);
    const p = pages[idx];
    if (p?._id) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('page', p._id!);
          return next;
        },
        { replace: true },
      );
    }
    setColor(mergePalette(p?.tapFill?.palette)[0]);
  };

  const hasActiveAudio = !!currentPlaylist;
  const mainPadBottom = hasActiveAudio
    ? 'max(var(--safe-area-bottom, 0px), 88px)'
    : 'max(var(--safe-area-bottom, 0px), 16px)';

  return (
    <div
      className="relative w-full h-[100dvh] overflow-hidden flex flex-col"
      style={{
        backgroundImage: `url(${WOOD_TEX})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-[#2a1810]/70" aria-hidden />

      <header
        className="relative z-10 flex items-center gap-2 px-3 py-2.5"
        style={{
          paddingTop: 'max(var(--safe-area-top, 0px), 10px)',
          backgroundImage: `url(${WOOD_TEX})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        <button
          type="button"
          onClick={goBack}
          className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform"
          style={woodBtnStyle}
          aria-label="Back to island"
        >
          <ArrowLeft size={22} className="text-white drop-shadow" strokeWidth={2.6} />
        </button>
        <h1
          className="flex-1 text-center font-display font-black text-white text-[1.05rem] sm:text-lg tracking-wide truncate px-1"
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.55)' }}
        >
          {title}
        </h1>
        <button
          type="button"
          onClick={openPlaylistPicker}
          className={`relative flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform ${
            hasActiveAudio && isPlaying ? 'ring-2 ring-amber-300' : ''
          }`}
          style={woodBtnStyle}
          aria-label={
            hasActiveAudio
              ? 'Music — change, pause, or stop playlist'
              : 'Play music while coloring'
          }
        >
          {hasActiveAudio && isPlaying ? (
            <Pause size={20} className="text-amber-200 drop-shadow" strokeWidth={2.6} />
          ) : hasActiveAudio ? (
            <Play size={20} className="text-amber-200 drop-shadow" strokeWidth={2.6} />
          ) : (
            <Music size={20} className="text-white drop-shadow" strokeWidth={2.6} />
          )}
        </button>
        <button
          type="button"
          onClick={() => canvasRef.current?.clear()}
          disabled={phase !== 'ready' || !useTapFill}
          className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform disabled:opacity-40"
          style={woodBtnStyle}
          aria-label="Clear colors"
        >
          <RefreshCw size={20} className="text-white drop-shadow" strokeWidth={2.6} />
        </button>
      </header>

      <main
        className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-2.5 sm:px-4 gap-3"
        style={{ paddingBottom: mainPadBottom }}
      >
        {phase === 'loading' && (
          <p className="font-display font-bold text-white/90 text-lg">
            Loading coloring…
          </p>
        )}

        {phase === 'missing' && (
          <div className="text-center space-y-3 max-w-sm mx-auto">
            <p className="font-display font-black text-white text-xl">
              Coloring coming soon
            </p>
            <p className="text-white/80 text-sm">
              Upload a tap-fill coloring page in the Bible Map story pack to
              unlock this activity.
            </p>
            <button
              type="button"
              onClick={goBack}
              className="mt-2 px-5 py-2.5 rounded-full font-display font-bold text-white active:scale-95"
              style={woodBtnStyle}
            >
              Back to island
            </button>
          </div>
        )}

        {phase === 'ready' && current && (
          <>
            {pages.length > 1 && (
              <div className="flex gap-2 flex-wrap justify-center">
                {pages.map((p, i) => (
                  <button
                    key={p._id || i}
                    type="button"
                    onClick={() => selectPage(i)}
                    className={`px-3 py-1.5 rounded-full font-display font-bold text-xs text-white active:scale-95 ${
                      i === pageIndex ? 'ring-2 ring-amber-300' : 'opacity-80'
                    }`}
                    style={woodBtnStyle}
                  >
                    Page {p.pageNumber ?? i + 1}
                  </button>
                ))}
              </div>
            )}

            <div className="w-full max-w-[min(100%,440px)] mx-auto flex flex-col items-center gap-3 min-h-0">
              {useTapFill ? (
                <>
                  <p className="text-white/80 text-xs font-display font-semibold text-center">
                    Pick a color, then tap a region to fill
                  </p>
                  <TapFillCanvas
                    ref={canvasRef}
                    lineArtUrl={lineArtUrl}
                    regionMapUrl={regionMapUrl}
                    color={color}
                    saveKey={`${islandId}-${current._id || pageIndex}`}
                    className="w-full"
                  />
                  <div className="w-full flex flex-wrap gap-1.5 justify-center content-center px-0.5 py-0.5">
                    {palette.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 active:scale-95 flex-shrink-0 ${
                          color === c
                            ? 'ring-2 ring-amber-300 border-white'
                            : 'border-[#6B4423]/70'
                        }`}
                        style={getColorSwatchStyle(c)}
                        aria-label={`Color ${c}`}
                        aria-pressed={color === c}
                      />
                    ))}
                  </div>
                </>
              ) : lineArtUrl ? (
                <div className="w-full h-[min(70dvh,520px)]">
                  <DrawingCanvas
                    prompt="Color the picture!"
                    backgroundImageUrl={lineArtUrl}
                    saveKey={`island-coloring-${islandId}-${current._id || pageIndex}`}
                    layeredMode
                  />
                </div>
              ) : (
                <p className="text-white/90">No image for this page.</p>
              )}
            </div>
          </>
        )}
      </main>

      {showPlaylistPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a playlist"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close playlist picker"
            onClick={closePlaylistPicker}
          />
          <div
            className="relative z-10 w-full max-w-md flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden mx-0 sm:mx-4 max-h-[min(88dvh,640px)]"
            style={{
              backgroundImage: `url(${WOOD_TEX})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.45)',
              paddingBottom: 'max(var(--safe-area-bottom, 0px), 14px)',
            }}
          >
            <div className="absolute inset-0 bg-[#2a1810]/75 rounded-t-3xl sm:rounded-3xl pointer-events-none" aria-hidden />

            <div className="relative z-10 flex items-center gap-2 px-4 pt-4 pb-2">
              <Music size={22} className="text-amber-200 flex-shrink-0" />
              <h2
                className="flex-1 font-display font-black text-white text-lg tracking-wide"
                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.55)' }}
              >
                Listen while coloring
              </h2>
              <button
                type="button"
                onClick={closePlaylistPicker}
                className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
                style={woodBtnStyle}
                aria-label="Close"
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            {hasActiveAudio && currentPlaylist && (
              <div className="relative z-10 mx-3 mb-2 rounded-2xl bg-black/35 border border-amber-200/30 px-3 py-2.5 flex items-center gap-2">
                <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-[#5c3a1a]">
                  {currentPlaylist.coverImage ? (
                    <CoverImage
                      src={currentPlaylist.coverImage}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music size={18} className="text-amber-200" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-100 text-[10px] font-bold uppercase tracking-wide">
                    Now playing
                  </p>
                  <p className="text-white font-display font-bold text-sm truncate">
                    {currentPlaylist.title}
                  </p>
                  {currentPlaylist.items?.[currentTrackIndex]?.title && (
                    <p className="text-white/70 text-xs truncate">
                      {currentPlaylist.items[currentTrackIndex].title}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => togglePlayPause()}
                  className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
                  style={woodBtnStyle}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause size={18} className="text-white" />
                  ) : (
                    <Play size={18} className="text-white" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closePlayer();
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
                  style={woodBtnStyle}
                  aria-label="Stop music"
                >
                  <Square size={16} className="text-white fill-white" />
                </button>
              </div>
            )}

            <div className="relative z-10 px-3 pb-3 flex flex-col min-h-0 flex-1 space-y-3">
              <p className="px-1 text-white/75 text-xs font-semibold">
                Tap an album to see songs, or surprise me
              </p>

              {playlistsLoading && (
                <p className="text-white/80 text-sm font-display font-bold text-center py-6">
                  Loading playlists…
                </p>
              )}

              {!playlistsLoading && playlistsError && (
                <div className="text-center py-4 space-y-3">
                  <p className="text-white/85 text-sm">{playlistsError}</p>
                  <button
                    type="button"
                    onClick={() => void fetchListenPlaylists()}
                    className="px-4 py-2 rounded-full font-display font-bold text-white text-sm active:scale-95"
                    style={woodBtnStyle}
                  >
                    Try again
                  </button>
                </div>
              )}

              {!playlistsLoading &&
                !playlistsError &&
                listenPlaylists.length === 0 && (
                  <p className="text-white/80 text-sm text-center py-6">
                    No playlists available right now.
                  </p>
                )}

              {!playlistsLoading && !playlistsError && listenPlaylists.length > 0 && (
                <>
                  <ul
                    aria-label="Listen albums"
                    className="max-h-[min(48dvh,340px)] overflow-y-auto overscroll-contain rounded-2xl border border-amber-200/25"
                  >
                    {listenPlaylists.map((playlist) => {
                      const isExpanded = expandedPlaylistId === playlist._id;
                      const isActiveAlbum =
                        (selectedPlaylistId || currentPlaylist?._id) ===
                        playlist._id;
                      const episodes =
                        episodesByPlaylistId[playlist._id] ||
                        playlist.items ||
                        [];
                      const isLoadingEpisodes =
                        episodesLoadingId === playlist._id;
                      const episodesError = episodesErrorById[playlist._id];

                      return (
                        <li
                          key={playlist._id}
                          className="border-b border-white/10 last:border-b-0"
                        >
                          <div
                            className={`flex items-stretch ${
                              isActiveAlbum ? 'bg-amber-900/45' : 'bg-black/25'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleAlbumExpand(playlist)}
                              aria-expanded={isExpanded}
                              className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left min-w-0"
                            >
                              <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-[#5c3a1a]">
                                {playlist.coverImage ? (
                                  <CoverImage
                                    src={playlist.coverImage}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Music
                                      size={18}
                                      className="text-amber-200/80"
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-display font-bold text-sm truncate">
                                  {playlist.title}
                                </p>
                                <p className="text-white/60 text-[11px] truncate">
                                  {playlist.author ||
                                    playlist.category ||
                                    `${episodes.length || playlist.items?.length || 0} songs`}
                                </p>
                              </div>
                              <ChevronDown
                                size={20}
                                className={`text-amber-100 flex-shrink-0 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePlayAlbum(playlist)}
                              className="w-12 flex items-center justify-center flex-shrink-0 border-l border-white/10 active:scale-95"
                              aria-label={`Play album ${playlist.title}`}
                              title="Play album"
                            >
                              <Play
                                size={18}
                                className={
                                  isActiveAlbum && isPlaying
                                    ? 'text-amber-200'
                                    : 'text-white/90'
                                }
                              />
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="bg-black/40 border-t border-amber-200/15">
                              {isLoadingEpisodes && (
                                <p className="px-4 py-3 text-white/70 text-xs font-semibold">
                                  Loading songs…
                                </p>
                              )}
                              {!isLoadingEpisodes && episodesError && (
                                <div className="px-4 py-3 flex items-center gap-2">
                                  <p className="flex-1 text-white/80 text-xs">
                                    {episodesError}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void fetchPlaylistEpisodes(playlist._id)
                                    }
                                    className="px-2.5 py-1 rounded-full text-[11px] font-bold text-white active:scale-95"
                                    style={woodBtnStyle}
                                  >
                                    Retry
                                  </button>
                                </div>
                              )}
                              {!isLoadingEpisodes &&
                                !episodesError &&
                                episodes.length === 0 && (
                                  <p className="px-4 py-3 text-white/65 text-xs">
                                    No songs in this album yet.
                                  </p>
                                )}
                              {!isLoadingEpisodes &&
                                !episodesError &&
                                episodes.length > 0 && (
                                  <ul aria-label={`Songs in ${playlist.title}`}>
                                    {episodes.map((episode, index) => {
                                      const isCurrentEpisode =
                                        currentPlaylist?._id === playlist._id &&
                                        currentTrackIndex === index;
                                      return (
                                        <li key={episode._id || `${playlist._id}-${index}`}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handlePlayEpisode(playlist, index)
                                            }
                                            className={`w-full flex items-center gap-2.5 pl-5 pr-3 py-2.5 text-left border-t border-white/5 ${
                                              isCurrentEpisode
                                                ? 'bg-amber-800/40'
                                                : 'hover:bg-white/5'
                                            }`}
                                          >
                                            <span className="w-5 text-center text-amber-100/70 text-[11px] font-bold flex-shrink-0">
                                              {index + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-white font-display font-semibold text-sm truncate">
                                                {episode.title || `Song ${index + 1}`}
                                              </p>
                                            </div>
                                            {isCurrentEpisode && isPlaying ? (
                                              <Pause
                                                size={15}
                                                className="text-amber-200 flex-shrink-0"
                                              />
                                            ) : (
                                              <Play
                                                size={15}
                                                className={`flex-shrink-0 ${
                                                  isCurrentEpisode
                                                    ? 'text-amber-200'
                                                    : 'text-white/70'
                                                }`}
                                              />
                                            )}
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSurprisePlaylist}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 font-display font-bold text-white text-sm active:scale-[0.98] transition-transform"
                      style={{ ...woodBtnStyle, borderRadius: '1rem' }}
                      aria-label="Surprise me — play a random playlist"
                    >
                      <Shuffle size={18} className="text-amber-200" />
                      Surprise me
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleShuffle()}
                      className={`min-w-[4.5rem] flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 font-display font-bold text-white text-sm active:scale-[0.98] transition-transform ${
                        isShuffle ? 'ring-2 ring-amber-300' : ''
                      }`}
                      style={{ ...woodBtnStyle, borderRadius: '1rem' }}
                      aria-label={
                        isShuffle
                          ? 'Shuffle on — tap to play in order'
                          : 'Shuffle off — tap to shuffle tracks'
                      }
                      aria-pressed={isShuffle}
                      title={isShuffle ? 'Shuffle on' : 'Shuffle tracks'}
                    >
                      <Shuffle
                        size={18}
                        className={isShuffle ? 'text-amber-200' : 'text-white/85'}
                      />
                      {isShuffle ? 'On' : 'Off'}
                    </button>
                  </div>

                  <p className="px-1 text-white/55 text-[11px] leading-snug">
                    {isShuffle
                      ? 'Shuffle is on — songs play in a random order. Surprise me picks a random album too.'
                      : 'Tap an album to pick a song. Play ▶ starts the whole album.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IslandColoringPage;
