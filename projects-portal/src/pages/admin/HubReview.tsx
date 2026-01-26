import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CheckCircle, 
  XCircle, 
  Music2, 
  User, 
  Play,
  Eye,
  Clock
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

const HubReview: React.FC = () => {
  const [playlists, setPlaylists] = useState<PendingPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PendingPlaylist | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      const token = localStorage.getItem('portal_admin_token');
      const res = await axios.get(`${API_URL}/api/hub/admin/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlaylists(res.data.playlists || []);
    } catch (error) {
      console.error('Error fetching pending:', error);
    } finally {
      setLoading(false);
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
        <p className="text-gray-500">Review and approve creator submissions</p>
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
      {playlists.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <CheckCircle className="w-16 h-16 mx-auto text-green-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
          <p className="text-gray-500 mt-1">No content pending review</p>
        </div>
      )}

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
