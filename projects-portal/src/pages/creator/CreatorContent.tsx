import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Plus, 
  Music2, 
  Edit, 
  Trash2, 
  Send, 
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

interface Playlist {
  _id: string;
  title: string;
  description: string;
  coverImage: string;
  type: string;
  priceTokens: number;
  status: string;
  items: any[];
  purchaseCount: number;
  totalTokensEarned: number;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const CreatorContent: React.FC = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const token = getToken();
      const res = await axios.get(`${API_URL}/api/hub/my-playlists`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlaylists(res.data.playlists || []);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForReview = async (playlistId: string) => {
    try {
      const token = getToken();
      await axios.post(
        `${API_URL}/api/hub/my-playlists/${playlistId}/submit`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPlaylists();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to submit for review');
    }
    setActionMenu(null);
  };

  const handleDelete = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;
    
    try {
      const token = getToken();
      await axios.delete(`${API_URL}/api/hub/my-playlists/${playlistId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPlaylists();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete');
    }
    setActionMenu(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" /> Published
          </span>
        );
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" /> Pending Review
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <AlertCircle className="w-3 h-3" /> Draft
          </span>
        );
    }
  };

  const filteredPlaylists = playlists.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Content</h1>
          <p className="text-gray-500">Manage your audiobooks and playlists</p>
        </div>
        <Link
          to="/creator/content/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Content
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'draft', 'pending_review', 'published', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlaylists.map((playlist) => (
          <div
            key={playlist._id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            {/* Cover Image */}
            <div className="aspect-square relative bg-gray-100">
              {playlist.coverImage ? (
                <img
                  src={playlist.coverImage}
                  alt={playlist.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music2 className="w-16 h-16 text-gray-300" />
                </div>
              )}
              <div className="absolute top-2 right-2">
                {getStatusBadge(playlist.status)}
              </div>
            </div>

            {/* Content Info */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 truncate">{playlist.title}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {playlist.type} · {playlist.items?.length || 0} episodes
              </p>
              
              <div className="flex items-center justify-between mt-3">
                <div>
                  <p className="text-lg font-bold text-indigo-600">
                    {playlist.priceTokens} tokens
                  </p>
                  <p className="text-xs text-gray-400">
                    ~${(playlist.priceTokens * 0.54).toFixed(2)} earnings
                  </p>
                </div>
                {playlist.status === 'published' && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {playlist.purchaseCount || 0} sales
                    </p>
                  </div>
                )}
              </div>

              {/* Rejection Note */}
              {playlist.status === 'rejected' && playlist.reviewNotes && (
                <div className="mt-3 p-2 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600">
                    <strong>Rejection reason:</strong> {playlist.reviewNotes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                {playlist.status === 'draft' && (
                  <>
                    <button
                      onClick={() => navigate(`/creator/content/edit/${playlist._id}`)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Edit className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => handleSubmitForReview(playlist._id)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Send className="w-4 h-4" /> Submit
                    </button>
                  </>
                )}
                {playlist.status === 'rejected' && (
                  <button
                    onClick={() => navigate(`/creator/content/edit/${playlist._id}`)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Edit & Resubmit
                  </button>
                )}
                {playlist.status === 'pending_review' && (
                  <span className="flex-1 text-center text-sm text-gray-500">
                    Awaiting admin review...
                  </span>
                )}
                {playlist.status === 'published' && (
                  <button
                    onClick={() => navigate(`/creator/content/view/${playlist._id}`)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Eye className="w-4 h-4" /> View
                  </button>
                )}
                {playlist.status !== 'published' && (
                  <button
                    onClick={() => handleDelete(playlist._id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredPlaylists.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Music2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No content found</h3>
          <p className="text-gray-500 mt-1">
            {filter === 'all' 
              ? 'Create your first audiobook or playlist to get started'
              : `No ${filter.replace('_', ' ')} content`}
          </p>
          {filter === 'all' && (
            <Link
              to="/creator/content/new"
              className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Content
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default CreatorContent;
