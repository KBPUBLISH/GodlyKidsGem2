import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Music2, 
  DollarSign, 
  ShoppingCart, 
  TrendingUp,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

interface DashboardStats {
  totalContent: number;
  publishedContent: number;
  pendingReview: number;
  totalSales: number;
  totalEarningsCents: number;
  pendingPayoutCents: number;
}

interface RecentSale {
  _id: string;
  createdAt: string;
  amount: number;
  creatorEarningsCents: number;
  relatedPlaylistId?: {
    title: string;
  };
}

const CreatorDashboard: React.FC = () => {
  const { getToken, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch playlists
      const playlistsRes = await axios.get(`${API_URL}/api/hub/my-playlists`, { headers });
      const allPlaylists = playlistsRes.data.playlists || [];
      setPlaylists(allPlaylists);

      // Fetch earnings
      const earningsRes = await axios.get(`${API_URL}/api/hub/my-earnings`, { headers });
      const earnings = earningsRes.data;

      // Calculate stats
      const stats: DashboardStats = {
        totalContent: allPlaylists.length,
        publishedContent: allPlaylists.filter((p: any) => p.status === 'published').length,
        pendingReview: allPlaylists.filter((p: any) => p.status === 'pending_review').length,
        totalSales: earnings.totalSalesCount || 0,
        totalEarningsCents: earnings.totalEarningsCents || 0,
        pendingPayoutCents: earnings.pendingPayoutCents || 0,
      };
      setStats(stats);
      setRecentSales(earnings.recentSales?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name || 'Creator'}!
          </h1>
          <p className="text-gray-500">Here's how your content is performing</p>
        </div>
        <Link
          to="/creator/content/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Content
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Content</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalContent || 0}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Music2 className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {stats?.publishedContent || 0} published, {stats?.pendingReview || 0} pending
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalSales || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats?.totalEarningsCents || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Payout</p>
              <p className="text-2xl font-bold text-indigo-600">
                {formatCurrency(stats?.pendingPayoutCents || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Your Content</h2>
            <Link to="/creator/content" className="text-sm text-indigo-600 hover:text-indigo-700">
              View All
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {playlists.slice(0, 5).map((playlist) => (
              <div key={playlist._id} className="p-4 flex items-center gap-4">
                {playlist.coverImage ? (
                  <img
                    src={playlist.coverImage}
                    alt={playlist.title}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Music2 className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{playlist.title}</p>
                  <p className="text-sm text-gray-500">
                    {playlist.priceTokens} tokens · {playlist.items?.length || 0} episodes
                  </p>
                </div>
                {getStatusBadge(playlist.status)}
              </div>
            ))}
            {playlists.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <Music2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No content yet</p>
                <Link
                  to="/creator/content/new"
                  className="text-indigo-600 hover:text-indigo-700 text-sm mt-2 inline-block"
                >
                  Create your first playlist
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Sales</h2>
            <Link to="/creator/earnings" className="text-sm text-indigo-600 hover:text-indigo-700">
              View All
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentSales.map((sale) => (
              <div key={sale._id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {sale.relatedPlaylistId?.title || 'Content Purchase'}
                  </p>
                  <p className="text-sm text-gray-500">{formatDate(sale.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">
                    +{formatCurrency(sale.creatorEarningsCents)}
                  </p>
                  <p className="text-xs text-gray-400">{Math.abs(sale.amount)} tokens</p>
                </div>
              </div>
            ))}
            {recentSales.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No sales yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Sales will appear here once your content is purchased
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorDashboard;
