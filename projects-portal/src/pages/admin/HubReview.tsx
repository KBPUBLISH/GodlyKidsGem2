import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CheckCircle, 
  XCircle, 
  Music2, 
  User, 
  Eye,
  Clock,
  Hammer,
  Star,
  AlertTriangle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

interface PendingPlaylist {
  _id: string;
  title: string;
  description: string;
  coverImage: string;
  type: string;
  priceTokens: number;
  items: any[];
  creatorId: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  submittedAt: string;
}

/** A published series whose creator just released another episode. */
interface EpisodeReview extends PendingPlaylist {
  pendingEpisodes: any[];
  releasedEpisodeCount?: number;
  plannedEpisodeCount?: number;
}

/** A series that is live in the app, and can therefore be featured. */
interface PublishedSeries extends Omit<PendingPlaylist, 'submittedAt'> {
  publishedAt?: string;
  isFeatured?: boolean;
  featuredOrder?: number;
  releasedEpisodeCount?: number;
  plannedEpisodeCount?: number;
}

interface FamilyReview {
  id: string;
  rating: number;
  comment?: string;
  displayName: string;
  holdReason?: string;
  createdAt: string;
  playlistTitle: string;
}

/** Matches the cap on GET /api/hub/featured. */
const FEATURED_LIMIT = 10;

const errorMessage = (error: unknown, fallback: string): string =>
  (axios.isAxiosError(error) && error.response?.data?.error) || fallback;

const HubReview: React.FC = () => {
  const [playlists, setPlaylists] = useState<PendingPlaylist[]>([]);
  const [episodeReviews, setEpisodeReviews] = useState<EpisodeReview[]>([]);
  const [familyReviews, setFamilyReviews] = useState<FamilyReview[]>([]);
  const [published, setPublished] = useState<PublishedSeries[]>([]);
  const [publishedError, setPublishedError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PendingPlaylist | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPending();
    fetchPublished();
  }, []);

  const fetchPending = async () => {
    try {
      const token = localStorage.getItem('portal_admin_token');
      const res = await axios.get(`${API_URL}/api/hub/admin/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlaylists(res.data.playlists || []);
      setEpisodeReviews(res.data.episodeReviews || []);
      setFamilyReviews(res.data.familyReviews || []);
    } catch (error) {
      console.error('Error fetching pending:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPublished = async () => {
    try {
      const token = localStorage.getItem('portal_admin_token');
      const res = await axios.get(`${API_URL}/api/hub/admin/playlists?status=published`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPublished(res.data.playlists || []);
      setPublishedError('');
    } catch (error) {
      // An empty list and a failed load look identical otherwise, and an admin
      // would read the second as "nothing is live yet".
      setPublishedError(errorMessage(error, 'Could not load live series'));
    }
  };

  const handleToggleFeatured = async (series: PublishedSeries) => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('portal_admin_token');
      await axios.put(
        `${API_URL}/api/hub/admin/playlists/${series._id}/featured`,
        { isFeatured: !series.isFeatured },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPublished();
    } catch (error) {
      alert(errorMessage(error, 'Failed to update featured status'));
    } finally {
      setProcessing(false);
    }
  };

  const handleEpisodeReview = async (
    playlistId: string,
    itemId: string,
    action: 'approve' | 'reject'
  ) => {
    const notes = action === 'reject'
      ? window.prompt('Why is this episode not approved?') || ''
      : '';
    if (action === 'reject' && !notes.trim()) return;

    setProcessing(true);
    try {
      const token = localStorage.getItem('portal_admin_token');
      await axios.put(
        `${API_URL}/api/hub/admin/playlists/${playlistId}/episodes/review`,
        { action, itemId, notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPending();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to process review');
    } finally {
      setProcessing(false);
    }
  };

  const handleFamilyReview = async (reviewId: string, action: 'approve' | 'reject') => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('portal_admin_token');
      await axios.put(
        `${API_URL}/api/hub/admin/reviews/${reviewId}`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPending();
    } catch (error: unknown) {
      alert(errorMessage(error, 'Failed to review family comment'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReview = async (playlistId: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      const token = localStorage.getItem('portal_admin_token');
      await axios.put(
        `${API_URL}/api/hub/admin/playlists/${playlistId}/review`,
        { action, notes: rejectNotes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSelectedPlaylist(null);
      setRejectNotes('');
      fetchPending();
      // An approval adds a series to the live list below.
      fetchPublished();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to process review');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const featuredCount = published.filter((series) => series.isFeatured).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Content Review</h1>
        <p className="text-gray-500">Review creator submissions and curate the featured shelf</p>
      </div>

      {/* Stats */}
      <div className="bg-yellow-50 rounded-xl p-4 flex items-center gap-3">
        <Clock className="w-6 h-6 text-yellow-600" />
        <div>
          <p className="font-medium text-yellow-800">
            {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'} pending review
          </p>
          <p className="text-sm text-yellow-600">
            Review submissions to make them available in Godly Hub
          </p>
        </div>
      </div>

      {/* New episodes on series that are already live. These bypass the full
          playlist review, so they get their own approve/reject queue. */}
      {episodeReviews.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Hammer className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              New episodes on live series
            </h2>
          </div>
          <div className="space-y-6">
            {episodeReviews.map((series) => (
              <div key={series._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{series.title}</h3>
                    <p className="text-sm text-gray-500">
                      {series.creatorId?.name} · {series.releasedEpisodeCount ?? 0} of{' '}
                      {series.items?.length || 0} released
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                    {series.pendingEpisodes.length} awaiting review
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  {series.pendingEpisodes.map((episode: any) => (
                    <div
                      key={episode._id}
                      className="bg-gray-50 rounded-lg p-3 flex flex-col gap-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{episode.title}</p>
                        {episode.description && (
                          <p className="text-xs text-gray-500">{episode.description}</p>
                        )}
                      </div>
                      {episode.audioUrl && (
                        <audio controls src={episode.audioUrl} className="w-full h-8" />
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEpisodeReview(series._id, episode._id, 'approve')}
                          disabled={processing}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => handleEpisodeReview(series._id, episode._id, 'reject')}
                          disabled={processing}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {familyReviews.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Family reviews held for a look
            </h2>
          </div>
          <div className="space-y-4">
            {familyReviews.map((review) => (
              <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900">{review.playlistTitle}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {review.displayName} · {review.rating} stars
                  {review.holdReason ? ` · ${review.holdReason}` : ''}
                </p>
                {review.comment && (
                  <p className="text-sm text-gray-700 mt-2">{review.comment}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleFamilyReview(review.id, 'approve')}
                    disabled={processing}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" /> Publish
                  </button>
                  <button
                    onClick={() => handleFamilyReview(review.id, 'reject')}
                    disabled={processing}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playlists.map((playlist) => (
          <div
            key={playlist._id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            {/* Cover Image */}
            <div className="aspect-video relative bg-gray-100">
              {playlist.coverImage ? (
                <img
                  src={playlist.coverImage}
                  alt={playlist.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music2 className="w-12 h-12 text-gray-300" />
                </div>
              )}
              <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                Pending Review
              </div>
            </div>

            {/* Content Info */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900">{playlist.title}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {playlist.description || 'No description'}
              </p>
              
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-2">
                  {playlist.creatorId?.profileImage ? (
                    <img
                      src={playlist.creatorId.profileImage}
                      alt={playlist.creatorId.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="w-3 h-3 text-gray-400" />
                    </div>
                  )}
                  <span className="text-sm text-gray-600">{playlist.creatorId?.name}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  {playlist.type} · {playlist.items?.length || 0} episodes · {playlist.priceTokens} tokens
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-2">
                Submitted {formatDate(playlist.submittedAt)}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => setSelectedPlaylist(playlist)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Eye className="w-4 h-4" /> Review
                </button>
                <button
                  onClick={() => handleReview(playlist._id, 'approve')}
                  disabled={processing}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {playlists.length === 0 && episodeReviews.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <CheckCircle className="w-16 h-16 mx-auto text-green-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
          <p className="text-gray-500 mt-1">No content pending review</p>
        </div>
      )}

      {/* Live series. Featuring one puts it on the Creators tab's shelf, which
          is served by GET /api/hub/featured. */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Live series</h2>
          </div>
          <span className="text-sm text-gray-500">
            {featuredCount} of {FEATURED_LIMIT} featured slots used
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Featured series appear on the Creators tab shelf in the app, ordered by featured order.
        </p>

        {publishedError ? (
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{publishedError}</p>
              <button
                onClick={fetchPublished}
                className="mt-2 text-sm text-red-700 underline hover:text-red-800"
              >
                Try again
              </button>
            </div>
          </div>
        ) : published.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <Music2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No published series yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Approve a submission above and it will show up here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {published.map((series) => (
              <div
                key={series._id}
                className="py-3 flex items-center gap-4 flex-wrap"
              >
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {series.coverImage ? (
                    <img
                      src={series.coverImage}
                      alt={series.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">{series.title}</h3>
                    {series.isFeatured && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium flex-shrink-0">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Featured
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {series.creatorId?.name} · {series.type} ·{' '}
                    {series.releasedEpisodeCount ?? 0} released
                    {(series.plannedEpisodeCount ?? 0) > 0 &&
                      ` · ${series.plannedEpisodeCount} coming soon`}
                  </p>
                </div>

                <button
                  onClick={() => handleToggleFeatured(series)}
                  disabled={processing}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                    series.isFeatured
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Star className={`w-4 h-4 ${series.isFeatured ? 'fill-white' : ''}`} />
                  {series.isFeatured ? 'Unfeature' : 'Feature'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedPlaylist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Review Content</h2>
              
              {/* Content Preview */}
              <div className="flex gap-4 mb-6">
                <div className="w-32 h-32 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {selectedPlaylist.coverImage ? (
                    <img
                      src={selectedPlaylist.coverImage}
                      alt={selectedPlaylist.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedPlaylist.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedPlaylist.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-gray-600">
                      By {selectedPlaylist.creatorId?.name}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-gray-600">{selectedPlaylist.type}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm font-medium text-purple-600">
                      {selectedPlaylist.priceTokens} tokens
                    </span>
                  </div>
                </div>
              </div>

              {/* Episodes */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-2">
                  Episodes ({selectedPlaylist.items?.length || 0})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedPlaylist.items?.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="w-6 h-6 flex items-center justify-center text-sm text-gray-500 bg-white rounded">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.title}</p>
                      </div>
                      {item.audioUrl && (
                        <audio controls className="h-8 w-48">
                          <source src={item.audioUrl} type="audio/mpeg" />
                        </audio>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rejection Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason (required if rejecting)
                </label>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Explain why this content is being rejected..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setSelectedPlaylist(null);
                    setRejectNotes('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleReview(selectedPlaylist._id, 'reject')}
                    disabled={processing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={() => handleReview(selectedPlaylist._id, 'approve')}
                    disabled={processing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HubReview;
