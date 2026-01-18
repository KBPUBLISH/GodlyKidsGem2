import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Download, 
  Search, 
  Trash2, 
  RefreshCw, 
  Users, 
  Gift,
  Bell,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://godlykids-backend.onrender.com';

interface EmailSubscriber {
  _id: string;
  email: string;
  source: string;
  bonusAwarded: boolean;
  bonusAmount: number;
  platform: string;
  parentName?: string;
  kidsCount?: number;
  optInUpdates: boolean;
  unsubscribedAt?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  bonusAwarded: number;
  optedIn: number;
  unsubscribed: number;
  bySource: Record<string, number>;
}

const EmailSubscribers: React.FC = () => {
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  const fetchSubscribers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('portal_admin_token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        ...(search && { search }),
        ...(sourceFilter && { source: sourceFilter }),
      });

      const response = await axios.get(`${API_URL}/api/email-subscribers?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSubscribers(response.data.subscribers);
      setStats(response.data.stats);
      setTotalPages(response.data.pagination.pages);
      setTotal(response.data.pagination.total);
    } catch (err: any) {
      console.error('Error fetching subscribers:', err);
      setError(err.response?.data?.error || 'Failed to fetch subscribers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, [page, sourceFilter]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchSubscribers();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('portal_admin_token');
      const response = await axios.get(`${API_URL}/api/email-subscribers/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `godlykids-subscribers-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export subscribers');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subscriber?')) return;
    
    try {
      const token = localStorage.getItem('portal_admin_token');
      await axios.delete(`${API_URL}/api/email-subscribers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSubscribers();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete subscriber');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'onboarding_bonus': return 'bg-green-100 text-green-800';
      case 'settings': return 'bg-blue-100 text-blue-800';
      case 'landing': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'ios': return '🍎';
      case 'android': return '🤖';
      case 'web': return '🌐';
      default: return '❓';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Mail className="w-8 h-8 text-indigo-600" />
            Email Subscribers
          </h1>
          <p className="text-gray-500 mt-1">
            Users who signed up for email updates and bonus coins
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSubscribers}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Total Subscribers</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Gift className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.bonusAwarded.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Bonuses Awarded</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Bell className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.optedIn.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Opted In Updates</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.unsubscribed}</p>
                <p className="text-sm text-gray-500">Unsubscribed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Source Breakdown */}
      {stats?.bySource && Object.keys(stats.bySource).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">By Source</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.bySource).map(([source, count]) => (
              <div 
                key={source}
                className={`px-4 py-2 rounded-lg ${getSourceBadgeColor(source)} cursor-pointer transition-transform hover:scale-105`}
                onClick={() => setSourceFilter(source === sourceFilter ? '' : source)}
              >
                <span className="font-medium">{source.replace(/_/g, ' ')}</span>
                <span className="ml-2 opacity-75">({count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email or parent name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Sources</option>
              <option value="onboarding_bonus">Onboarding Bonus</option>
              <option value="settings">Settings</option>
              <option value="landing">Landing</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && subscribers.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : subscribers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Mail className="w-12 h-12 mb-3 opacity-50" />
            <p>No subscribers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Parent / Kids
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subscribers.map((sub) => (
                  <tr key={sub._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{sub.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <span className="text-gray-900">{sub.parentName || '-'}</span>
                        {sub.kidsCount && (
                          <span className="text-gray-500 ml-2">({sub.kidsCount} kids)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getSourceBadgeColor(sub.source)}`}>
                        {sub.source.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-lg" title={sub.platform}>
                        {getPlatformIcon(sub.platform)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {sub.bonusAwarded && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            🪙 +{sub.bonusAmount}
                          </span>
                        )}
                        {sub.optInUpdates && !sub.unsubscribedAt && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            <Bell className="w-3 h-3 mr-1" />
                            Updates
                          </span>
                        )}
                        {sub.unsubscribedAt && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Unsubscribed
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(sub.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(sub._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete subscriber"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * 25) + 1} - {Math.min(page * 25, total)} of {total} subscribers
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="px-4 py-2 text-sm font-medium text-gray-900">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailSubscribers;
