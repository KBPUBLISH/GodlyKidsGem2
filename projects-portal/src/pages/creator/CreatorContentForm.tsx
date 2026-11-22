import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Upload, 
  Music2, 
  Plus, 
  Trash2, 
  GripVertical,
  ArrowLeft,
  Save,
  DollarSign,
  Info,
  Clock,
  Lock,
  Hammer,
  AlertCircle,
  Link2,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCentsPerToken, tokensToDollars } from '../../hooks/useCentsPerToken';

const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

interface AudioItem {
  _id?: string;
  title: string;
  description: string;
  coverImage: string;
  audioUrl: string;
  duration?: number;
  order: number;
  /** Announced but not finished — listed in the app with a release month. */
  planned?: boolean;
  releaseDate?: string;
  /** Set by the backend; episodes released after publish await approval. */
  reviewStatus?: 'approved' | 'pending' | 'rejected';
}

interface PlaylistData {
  title: string;
  description: string;
  type: 'Audiobook' | 'Song';
  priceTokens: number;
  priceUSD: number | null;
  usdPurchaseEnabled: boolean;
  coverImage: string;
  categories: string[];
  minAge?: number;
  items: AudioItem[];
  /** Cadence promise shown on the pledge card, e.g. "One a month". */
  releasePlan?: string;
}

/** <input type="month"> works in "YYYY-MM"; the API stores a Date. */
const toMonthInput = (value?: string) => (value ? value.slice(0, 7) : '');
const fromMonthInput = (value: string) => (value ? `${value}-01` : '');

/**
 * The creator endpoints answer a request they refuse with a short server-side
 * phrase that means nothing to the person who pressed Save. These say what the
 * refusal implies about their session, and which of them can be acted on by
 * signing in again.
 */
const SAVE_REFUSALS: Record<string, { message: string; creatorSignIn?: boolean }> = {
  'Creator access required': {
    message:
      "You're signed in as an admin, not a creator. Content must be created from a creator account.",
    creatorSignIn: true,
  },
  'Creator account is not active': {
    message:
      'Your creator account is not active yet, so it cannot hold content. Ask an admin to activate it, then try again.',
  },
};

interface ApiError {
  message?: string;
  response?: { data?: { error?: string; msg?: string } };
}

/**
 * Every backend error here is shaped { error: string }; the app's older routes
 * use { msg }. Falling straight through to "Failed to save" threw away the one
 * sentence that explained the failure.
 */
const describeSaveError = (error: ApiError): { message: string; creatorSignIn?: boolean } => {
  const serverMessage = error?.response?.data?.error || error?.response?.data?.msg;

  if (serverMessage && SAVE_REFUSALS[serverMessage]) {
    return SAVE_REFUSALS[serverMessage];
  }

  return { message: serverMessage || error?.message || 'Failed to save' };
};

/**
 * Audio and cover art can each arrive two ways: uploaded here, or pasted as a
 * link to somewhere the creator already hosts it.
 *
 * Both still land in the same single field (`audioUrl`, `coverImage`), so an
 * episode can never hold an upload and a link at once and there is no
 * precedence to resolve. Which of the two a saved value came from is read back
 * off the URL instead of being stored alongside it, so the label shown to the
 * creator cannot drift away from the value it describes.
 */
type MediaSource = 'upload' | 'link';

/** URLs our own upload endpoint hands back: GCS, or the local uploads folder. */
const isOwnUpload = (url: string) =>
  /^https?:\/\/storage\.googleapis\.com\//i.test(url) || url.includes('/uploads/');

const sourceOf = (url?: string): MediaSource | null =>
  !url ? null : isOwnUpload(url) ? 'upload' : 'link';

/**
 * The app loads media from an https origin, so an http link is refused as
 * mixed content on the web build and by App Transport Security on iOS: it
 * would save cleanly and then simply never play. This form is the last place
 * the creator can still fix that, so http is rejected here rather than
 * accepted and left to fail silently in front of a child.
 */
const describeUrlProblem = (raw?: string): string | null => {
  const value = (raw || '').trim();
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'That is not a complete web address — it should start with https://';
  }

  if (parsed.protocol === 'http:') {
    return 'Use an https:// address. http links are blocked inside the app and will not play.';
  }
  if (parsed.protocol !== 'https:') {
    return 'Only https:// web addresses can be used.';
  }
  if (!parsed.hostname.includes('.')) {
    return 'That address has no website name in it.';
  }
  return null;
};

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

/** How long to wait for a pasted link to prove itself before giving up. */
const PROBE_TIMEOUT_MS = 12000;

/**
 * A link that returns a web page, a 404, or a format the app can't decode is a
 * real and quiet failure mode, so the browser is asked to actually load the
 * media before the creator saves. Audio metadata also carries the duration,
 * which the upload path gets from the server and the link path otherwise
 * wouldn't have at all.
 */
const probeAudioUrl = (url: string): Promise<{ ok: boolean; duration?: number }> =>
  new Promise((resolve) => {
    const audio = document.createElement('audio');
    let settled = false;
    const finish = (ok: boolean, duration?: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeAttribute('src');
      resolve({ ok, duration });
    };
    const timer = window.setTimeout(() => finish(false), PROBE_TIMEOUT_MS);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () =>
      finish(true, Number.isFinite(audio.duration) ? Math.round(audio.duration) : undefined);
    audio.onerror = () => finish(false);
    audio.src = url;
  });

const probeImageUrl = (url: string): Promise<boolean> =>
  new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), PROBE_TIMEOUT_MS);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });

type LinkCheck =
  | { status: 'checking' }
  | { status: 'ok'; duration?: number }
  | { status: 'bad'; message: string };

interface MediaSourceFieldProps {
  label: string;
  kind: 'audio' | 'image';
  value: string;
  /** Which input is showing — not necessarily where `value` came from. */
  mode: MediaSource;
  locked?: boolean;
  uploading?: boolean;
  check?: LinkCheck;
  /** Shown behind an empty image field to explain what happens if it stays empty. */
  fallbackImage?: string;
  onModeChange: (mode: MediaSource) => void;
  onFile: (file: File) => void;
  onLinkChange: (value: string) => void;
  onClear: () => void;
}

/**
 * One media field with two interchangeable ways to fill it. The toggle says
 * which input is open; the line underneath says what is actually saved.
 */
const MediaSourceField: React.FC<MediaSourceFieldProps> = ({
  label,
  kind,
  value,
  mode,
  locked,
  uploading,
  check,
  fallbackImage,
  onModeChange,
  onFile,
  onLinkChange,
  onClear,
}) => {
  // Switching source empties the field, so whatever is in it now came from the
  // input that is currently open. `sourceOf` only picks which input that is when
  // an already-saved episode is opened.
  const isAudio = kind === 'audio';

  const tab = (target: MediaSource, text: string, Icon: typeof Upload) => (
    <button
      type="button"
      disabled={locked}
      onClick={() => onModeChange(target)}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
        mode === target
          ? 'bg-white text-indigo-600 shadow-sm font-medium'
          : 'text-gray-500 hover:text-gray-700'
      } disabled:text-gray-300 disabled:hover:text-gray-300`}
    >
      <Icon className="w-3 h-3" />
      {text}
    </button>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <label className="block text-xs text-gray-500">{label}</label>
        <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
          {tab('upload', 'Upload', Upload)}
          {tab('link', 'Paste link', Link2)}
        </div>
      </div>

      <div className="flex items-start gap-2">
        {!isAudio && (
          <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-50">
            {value ? (
              <img src={value} alt="" className="w-full h-full object-cover" />
            ) : fallbackImage ? (
              <img src={fallbackImage} alt="" className="w-full h-full object-cover opacity-40" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-gray-300" />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {mode === 'upload' ? (
            <label
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm w-full justify-center ${
                locked
                  ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
              }`}
            >
              <Upload className="w-4 h-4" />
              {locked
                ? 'Locked'
                : uploading
                  ? 'Uploading...'
                  : value
                    ? `Replace ${isAudio ? 'Audio' : 'Image'}`
                    : `Upload ${isAudio ? 'Audio' : 'Image'}`}
              <input
                type="file"
                accept={isAudio ? 'audio/*' : 'image/*'}
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                disabled={locked || uploading}
              />
            </label>
          ) : (
            <input
              type="url"
              inputMode="url"
              value={value}
              disabled={locked}
              onChange={(e) => onLinkChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              placeholder={isAudio ? 'https://…/episode.mp3' : 'https://…/cover.jpg'}
            />
          )}

          {/* What is actually saved right now, and how to get rid of it. */}
          {value && (
            <div className="flex items-start justify-between gap-2 mt-1">
              <p className="text-xs text-gray-500 min-w-0">
                {mode === 'upload' ? (
                  <span className="text-green-600">
                    ✓ {isAudio ? 'Audio uploaded' : 'Image uploaded'}
                  </span>
                ) : check?.status === 'checking' ? (
                  <span className="text-gray-500">Checking link…</span>
                ) : check?.status === 'ok' ? (
                  <span className="text-green-600">
                    {isAudio ? '✓ Link plays' : '✓ Image loads'}
                    {check.duration ? ` · ${formatDuration(check.duration)}` : ''}
                  </span>
                ) : check?.status === 'bad' ? (
                  <span className="text-amber-700">{check.message}</span>
                ) : (
                  <span className="text-gray-500 break-all">Using linked {isAudio ? 'audio' : 'image'}</span>
                )}
              </p>
              {!locked && (
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          )}
          {!value && !isAudio && fallbackImage && (
            <p className="text-xs text-gray-400 mt-1">Optional — the series cover is used instead.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const CreatorContentForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const centsPerToken = useCentsPerToken();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Kept on the page rather than alerted: a refused save is worth reading twice.
  const [saveError, setSaveError] = useState<{ message: string; creatorSignIn?: boolean } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  // Which input each media field is showing. Absent means "whatever the saved
  // value already is", so an episode opens on the source it was filled from.
  const [mediaModes, setMediaModes] = useState<Record<string, MediaSource>>({});
  const [linkChecks, setLinkChecks] = useState<Record<string, LinkCheck>>({});
  // Probes are debounced per field, so typing a URL doesn't fire one per keystroke.
  const probeTimers = React.useRef<Record<string, number>>({});
  // Published series can only be edited through the episodes endpoint, which
  // freezes what's already live and sends new releases to review.
  const [status, setStatus] = useState<string>('draft');
  const isPublished = status === 'published';
  
  const [data, setData] = useState<PlaylistData>({
    title: '',
    description: '',
    type: 'Audiobook',
    priceTokens: 10,
    priceUSD: null,
    usdPurchaseEnabled: false,
    coverImage: '',
    categories: ['Godly Hub'],
    items: [],
  });

  useEffect(() => {
    if (isEditing) {
      fetchPlaylist();
    }
  }, [id]);

  const fetchPlaylist = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await axios.get(`${API_URL}/api/hub/my-playlists/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const playlist = res.data.playlist;
      setStatus(playlist.status || 'draft');
      setData({
        title: playlist.title,
        description: playlist.description || '',
        type: playlist.type,
        priceTokens: playlist.priceTokens,
        priceUSD: playlist.priceUSD || null,
        usdPurchaseEnabled: playlist.usdPurchaseEnabled || false,
        coverImage: playlist.coverImage || '',
        categories: playlist.categories || ['Godly Hub'],
        minAge: playlist.minAge,
        releasePlan: playlist.releasePlan || '',
        items: (playlist.items || []).map((item: AudioItem) => ({
          ...item,
          releaseDate: toMonthInput(item.releaseDate),
        })),
      });
    } catch (error) {
      console.error('Error fetching playlist:', error);
      alert('Failed to load content');
      navigate('/creator/content');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File, type: 'cover' | 'item', itemIndex?: number) => {
    const uploadKey = type === 'cover' ? 'cover' : `item-${itemIndex}`;
    setUploading(uploadKey);

    try {
      const formData = new FormData();
      formData.append('file', file); // Backend expects 'file' field name

      // Per-episode art is stored apart from the series cover, and both are
      // optimized to WebP by the upload route.
      const uploadType = type === 'item' ? 'episode-cover' : 'cover';

      const res = await axios.post(
        `${API_URL}/api/upload/image?bookId=hub-content&type=${uploadType}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const imageUrl = res.data.url;

      if (type === 'cover') {
        setData(prev => ({ ...prev, coverImage: imageUrl }));
      } else if (itemIndex !== undefined) {
        setData(prev => ({
          ...prev,
          items: prev.items.map((item, i) => 
            i === itemIndex ? { ...item, coverImage: imageUrl } : item
          ),
        }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(null);
    }
  };

  const handleAudioUpload = async (file: File, itemIndex: number) => {
    setUploading(`audio-${itemIndex}`);

    try {
      const formData = new FormData();
      formData.append('file', file); // Backend expects 'file' field name

      const res = await axios.post(
        `${API_URL}/api/upload/audio?bookId=hub-content&type=episode`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const audioUrl = res.data.url;

      setData(prev => ({
        ...prev,
        items: prev.items.map((item, i) => 
          i === itemIndex ? { ...item, audioUrl, duration: res.data.duration } : item
        ),
      }));
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload audio');
    } finally {
      setUploading(null);
    }
  };

  const addItem = (planned = false) => {
    setData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          title: `Episode ${prev.items.length + 1}`,
          description: '',
          coverImage: '',
          audioUrl: '',
          order: prev.items.length,
          planned,
          releaseDate: '',
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
    // Both maps are keyed by position, so a removal would leave every later
    // episode wearing the previous one's link status.
    setMediaModes({});
    setLinkChecks({});
  };

  const updateItem = (index: number, field: keyof AudioItem, value: string | boolean | number | undefined) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  /** Flipping an episode to "coming soon" clears the audio it can't have yet. */
  const togglePlanned = (index: number, planned: boolean) => {
    setLinkChecks(prev => {
      const next = { ...prev };
      delete next[`audio-${index}`];
      return next;
    });
    setData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index
          ? { ...item, planned, audioUrl: planned ? '' : item.audioUrl, duration: planned ? undefined : item.duration }
          : item
      ),
    }));
  };

  const mediaKey = (kind: 'audio' | 'cover', index: number) => `${kind}-${index}`;

  /** The open input: the creator's explicit choice, else where the value came from. */
  const mediaMode = (kind: 'audio' | 'cover', index: number, value: string): MediaSource =>
    mediaModes[mediaKey(kind, index)] || sourceOf(value) || 'upload';

  /**
   * Switching source clears the field. Keeping the old value while showing the
   * other input is what would create the ambiguous "both set" state the single
   * field is meant to rule out, and it would leave the creator unsure which one
   * the app is going to play.
   */
  const setMediaMode = (kind: 'audio' | 'cover', index: number, mode: MediaSource) => {
    const key = mediaKey(kind, index);
    setMediaModes(prev => ({ ...prev, [key]: mode }));
    setLinkChecks(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i !== index
          ? item
          : kind === 'audio'
            ? { ...item, audioUrl: '', duration: undefined }
            : { ...item, coverImage: '' }
      ),
    }));
  };

  /** Empty the field but stay on the input the creator was using. */
  const clearMedia = (kind: 'audio' | 'cover', index: number, current: string) => {
    setMediaMode(kind, index, mediaMode(kind, index, current));
  };

  /**
   * A pasted link is stored as the creator types it, then checked once they
   * stop. The check is advisory — an unreachable link still blocks Save via
   * `describeUrlProblem`, but a CORS-shy host that refuses the probe should not
   * stop a creator who knows their link is good.
   */
  const handleLinkChange = (kind: 'audio' | 'cover', index: number, raw: string) => {
    const key = mediaKey(kind, index);
    const value = raw.trim();

    setData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i !== index
          ? item
          : kind === 'audio'
            ? { ...item, audioUrl: value, duration: undefined }
            : { ...item, coverImage: value }
      ),
    }));

    window.clearTimeout(probeTimers.current[key]);
    setLinkChecks(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (!value) return;

    const problem = describeUrlProblem(value);
    if (problem) {
      setLinkChecks(prev => ({ ...prev, [key]: { status: 'bad', message: problem } }));
      return;
    }

    probeTimers.current[key] = window.setTimeout(async () => {
      setLinkChecks(prev => ({ ...prev, [key]: { status: 'checking' } }));
      if (kind === 'audio') {
        const { ok, duration } = await probeAudioUrl(value);
        setLinkChecks(prev => ({
          ...prev,
          [key]: ok
            ? { status: 'ok', duration }
            : { status: 'bad', message: "This link didn't play. Check it opens an audio file directly." },
        }));
        if (ok && duration) updateItem(index, 'duration', duration);
      } else {
        const ok = await probeImageUrl(value);
        setLinkChecks(prev => ({
          ...prev,
          [key]: ok
            ? { status: 'ok' }
            : { status: 'bad', message: "This link didn't load as an image." },
        }));
      }
    }, 700);
  };

  /** An episode is live once it's approved and no longer planned. */
  const isLive = (item: AudioItem) =>
    !item.planned && !!item.audioUrl && (item.reviewStatus || 'approved') === 'approved';

  const releasedCount = data.items.filter(item => !item.planned).length;
  const plannedCount = data.items.filter(item => item.planned).length;
  const inProgress = plannedCount > 0;

  const handleSave = async (submit = false) => {
    if (!data.title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (data.priceTokens < 1 || data.priceTokens > 500) {
      alert('Token price must be between 1 and 500 tokens');
      return;
    }

    if (data.usdPurchaseEnabled && (!data.priceUSD || data.priceUSD < 0.99 || data.priceUSD > 99.99)) {
      alert('USD price must be between $0.99 and $99.99');
      return;
    }

    if (submit && data.items.length === 0) {
      alert('Please add at least one episode');
      return;
    }

    const badItem = data.items.find(item =>
      item.planned ? !item.releaseDate : !item.audioUrl
    );
    if (badItem) {
      alert(badItem.planned
        ? `"${badItem.title}" is marked coming soon, so it needs a release month`
        : `"${badItem.title}" needs an audio file or link, or mark it coming soon`);
      return;
    }

    // A malformed link saves without complaint and then fails in the app, so it
    // is stopped here where the creator still has the address in front of them.
    for (const item of data.items) {
      const audioProblem = describeUrlProblem(item.audioUrl);
      if (audioProblem) {
        alert(`"${item.title}" audio link: ${audioProblem}`);
        return;
      }
      const coverProblem = describeUrlProblem(item.coverImage);
      if (coverProblem) {
        alert(`"${item.title}" cover image link: ${coverProblem}`);
        return;
      }
    }

    if (submit && releasedCount === 0) {
      alert('At least one episode must be ready — a series cannot be all coming soon');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };

      // Dates go to the API as real dates, not "YYYY-MM".
      const payload = {
        ...data,
        items: data.items.map(item => ({
          ...item,
          releaseDate: item.planned ? fromMonthInput(item.releaseDate || '') : undefined,
        })),
      };

      let playlistId = id;

      if (isPublished) {
        // Live series: only the episode list and release plan can change.
        const res = await axios.put(
          `${API_URL}/api/hub/my-playlists/${id}/episodes`,
          { items: payload.items, releasePlan: data.releasePlan },
          { headers }
        );
        if (res.data.newlyReleased > 0) {
          alert(`${res.data.newlyReleased} new episode(s) sent for review. They go live once approved.`);
        }
        navigate('/creator/content');
        return;
      }

      if (isEditing) {
        await axios.put(`${API_URL}/api/hub/my-playlists/${id}`, payload, { headers });
      } else {
        const res = await axios.post(`${API_URL}/api/hub/my-playlists`, payload, { headers });
        playlistId = res.data.playlist._id;
      }

      if (submit && playlistId) {
        await axios.post(
          `${API_URL}/api/hub/my-playlists/${playlistId}/submit`,
          {},
          { headers }
        );
        alert('Content submitted for review!');
      }

      navigate('/creator/content');
    } catch (error: any) {
      console.error('Save error:', error);
      setSaveError(describeSaveError(error));
    } finally {
      setSaving(false);
    }
  };

  const estimatedEarnings = tokensToDollars(data.priceTokens, centsPerToken);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/creator/content')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Content' : 'Create New Content'}
          </h1>
          <p className="text-gray-500">Fill in the details below</p>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Cover Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cover Image
          </label>
          <div className="flex items-start gap-4">
            <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              {data.coverImage ? (
                <img src={data.coverImage} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music2 className="w-10 h-10 text-gray-300" />
                </div>
              )}
            </div>
            <div>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                {uploading === 'cover' ? 'Uploading...' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'cover')}
                  disabled={uploading === 'cover'}
                />
              </label>
              <p className="text-xs text-gray-400 mt-2">Recommended: 1000x1000px, JPG or PNG</p>
            </div>
          </div>
        </div>

        {/* Title & Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <select
              value={data.type}
              onChange={(e) => setData(prev => ({ ...prev, type: e.target.value as 'Audiobook' | 'Song' }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="Audiobook">Audiobook</option>
              <option value="Song">Song Album</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={data.description}
            onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Describe your content..."
          />
        </div>

        {/* Pricing Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            Pricing Options
          </h3>

          {/* Token Price */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Price (in-app purchases) *
            </label>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-xs">
                <input
                  type="number"
                  value={data.priceTokens}
                  onChange={(e) => setData(prev => ({ ...prev, priceTokens: parseInt(e.target.value) || 0 }))}
                  min={1}
                  max={500}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">tokens</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
                <span className="text-sm font-medium text-green-700">
                  ~${estimatedEarnings} your earnings
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Token purchases: after store and platform fees, you earn ~${(centsPerToken / 100).toFixed(2)} per token.
            </p>
          </div>

          {/* USD Price (Stripe) */}
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                USD Price (Stripe checkout)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.usdPurchaseEnabled}
                  onChange={(e) => setData(prev => ({ 
                    ...prev, 
                    usdPurchaseEnabled: e.target.checked,
                    priceUSD: e.target.checked && !prev.priceUSD ? 4.99 : prev.priceUSD
                  }))}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600">Enable USD purchases</span>
              </label>
            </div>
            
            {data.usdPurchaseEnabled && (
              <>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={data.priceUSD || ''}
                      onChange={(e) => setData(prev => ({ ...prev, priceUSD: parseFloat(e.target.value) || null }))}
                      min={0.99}
                      max={99.99}
                      step={0.01}
                      placeholder="4.99"
                      className="w-full pl-7 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                    />
                  </div>
                  {data.priceUSD && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-green-700">
                        ~${(data.priceUSD * 0.70).toFixed(2)} your earnings
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Stripe purchases: After fees (Stripe 3% + GodlyKids 27%), you earn ~70% of the price.
                </p>
                <p className="text-xs text-indigo-600 mt-1">
                  💡 USD purchases bypass Apple's IAP, allowing direct credit card payments via Stripe.
                </p>
              </>
            )}
            
            {!data.usdPurchaseEnabled && (
              <p className="text-xs text-gray-500">
                Enable this to allow parents to purchase directly with credit card (higher creator earnings).
              </p>
            )}
          </div>
        </div>

        {/* Age Recommendation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Age (optional)
          </label>
          <select
            value={data.minAge || ''}
            onChange={(e) => setData(prev => ({ ...prev, minAge: e.target.value ? parseInt(e.target.value) : undefined }))}
            className="w-full max-w-xs px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">All ages</option>
            <option value="3">3+</option>
            <option value="5">5+</option>
            <option value="7">7+</option>
            <option value="10">10+</option>
            <option value="13">13+</option>
          </select>
        </div>
      </div>

      {/* Episodes/Songs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {data.type === 'Audiobook' ? 'Episodes' : 'Songs'}
            </h2>
            {data.items.length > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                {inProgress
                  ? `${releasedCount} of ${data.items.length} ready · ${plannedCount} coming soon`
                  : `${data.items.length} ready · series marked complete`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => addItem(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm"
            >
              <Clock className="w-4 h-4" />
              Add Coming Soon
            </button>
            <button
              onClick={() => addItem(false)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add {data.type === 'Audiobook' ? 'Episode' : 'Song'}
            </button>
          </div>
        </div>

        {/* An unfinished series can still be bought — as a pledge. Tell the
            creator what that means and let them promise a cadence. */}
        {inProgress && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Hammer className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  This series will show as In Progress
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  Families can buy it now as a pledge: they get the {releasedCount} ready
                  {data.type === 'Audiobook' ? ' episode' : ' song'}{releasedCount === 1 ? '' : 's'} today
                  and every coming-soon one free as you release it.
                </p>
                <label className="block text-xs font-medium text-amber-900 mt-3 mb-1">
                  Your release promise
                </label>
                <input
                  type="text"
                  value={data.releasePlan || ''}
                  onChange={(e) => setData(prev => ({ ...prev, releasePlan: e.target.value }))}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="e.g. One new episode every month"
                />
              </div>
            </div>
          </div>
        )}

        {isPublished && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              This series is live. Episodes families already own are locked, but you can
              schedule new ones and release them by uploading audio — each new release goes
              to our review team before it appears in the app.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {data.items.map((item, index) => {
            const locked = isPublished && isLive(item);
            const pending = item.reviewStatus === 'pending';
            const rejected = item.reviewStatus === 'rejected';
            return (
            <div
              key={item._id || index}
              className={`rounded-lg p-4 space-y-4 border ${
                item.planned
                  ? 'border-dashed border-amber-300 bg-amber-50/40'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-700">
                    {data.type === 'Audiobook' ? `Episode ${index + 1}` : `Track ${index + 1}`}
                  </span>
                  {locked && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
                      <Lock className="w-3 h-3" /> Live
                    </span>
                  )}
                  {pending && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                      In review
                    </span>
                  )}
                  {rejected && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">
                      Not approved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label
                    className={`inline-flex items-center gap-2 text-xs ${
                      locked ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!item.planned}
                      disabled={locked}
                      onChange={(e) => togglePlanned(index, e.target.checked)}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    Coming soon
                  </label>
                  <button
                    onClick={() => removeItem(index)}
                    disabled={locked}
                    title={locked ? 'Live episodes cannot be removed' : 'Remove'}
                    className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <input
                    type="text"
                    value={item.title}
                    disabled={locked}
                    onChange={(e) => updateItem(index, 'title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="Episode title"
                  />
                </div>
                {item.planned ? (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Expected release *</label>
                    <input
                      type="month"
                      value={item.releaseDate || ''}
                      onChange={(e) => updateItem(index, 'releaseDate', e.target.value)}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <p className="text-xs text-amber-700 mt-1">
                      Shown in the app as "Coming {item.releaseDate
                        ? new Date(`${item.releaseDate}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                        : '…'}"
                    </p>
                  </div>
                ) : (
                  <MediaSourceField
                    label="Audio File *"
                    kind="audio"
                    value={item.audioUrl}
                    mode={mediaMode('audio', index, item.audioUrl)}
                    locked={locked}
                    uploading={uploading === `audio-${index}`}
                    check={linkChecks[mediaKey('audio', index)]}
                    onModeChange={(mode) => setMediaMode('audio', index, mode)}
                    onFile={(file) => handleAudioUpload(file, index)}
                    onLinkChange={(value) => handleLinkChange('audio', index, value)}
                    onClear={() => clearMedia('audio', index, item.audioUrl)}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <MediaSourceField
                  label="Episode Cover (optional)"
                  kind="image"
                  value={item.coverImage || ''}
                  mode={mediaMode('cover', index, item.coverImage || '')}
                  locked={locked}
                  uploading={uploading === `item-${index}`}
                  check={linkChecks[mediaKey('cover', index)]}
                  fallbackImage={data.coverImage}
                  onModeChange={(mode) => setMediaMode('cover', index, mode)}
                  onFile={(file) => handleImageUpload(file, 'item', index)}
                  onLinkChange={(value) => handleLinkChange('cover', index, value)}
                  onClear={() => clearMedia('cover', index, item.coverImage || '')}
                />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={item.description}
                    disabled={locked}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="Brief description"
                  />
                </div>
              </div>
            </div>
            );
          })}

          {data.items.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Music2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No {data.type === 'Audiobook' ? 'episodes' : 'songs'} yet</p>
              <button
                onClick={() => addItem(false)}
                className="text-indigo-600 hover:text-indigo-700 text-sm mt-2"
              >
                Add your first {data.type === 'Audiobook' ? 'episode' : 'song'}
              </button>
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Nothing was saved</p>
            <p className="text-sm text-red-800 mt-1">{saveError.message}</p>
            {saveError.creatorSignIn && (
              <button
                onClick={() => navigate('/creator/login')}
                className="text-sm font-medium text-red-900 underline mt-2"
              >
                Sign in as a creator
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <button
          onClick={() => navigate('/creator/content')}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          {isPublished ? (
            // A live series has nothing to submit — saving IS the release.
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Episodes'}
            </button>
          ) : (
            <>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving || data.items.length === 0}
                className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save & Submit for Review'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorContentForm;
