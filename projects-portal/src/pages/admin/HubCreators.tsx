import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  UserPlus, 
  User, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock,
  Copy,
  MoreVertical,
  DollarSign
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

interface Creator {
  _id: string;
  email: string;
  name: string;
  profileImage?: string;
  status: 'invited' | 'active' | 'suspended';
  totalEarningsCents: number;
  pendingPayoutCents: number;
  totalContentCount: number;
  totalSalesCount: number;
  invitedAt: string;
  activatedAt?: string;
}

const HubCreators: React.FC = () => {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchCreators();
  }, []);

  const fetchCreators = async () => {
    try {
      const token = localStorage.getItem('portal_admin_token');
      const res = await axios.get(`${API_URL}/api/hub/admin/creators`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCreators(res.data.creators || []);
    } catch (error) {
      console.error('Error fetching creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) {
      alert('Email and name are required');
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('portal_admin_token');
      const res = await axios.post(
        `${API_URL}/api/hub/admin/creators/invite`,
        { email: inviteEmail, name: inviteName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setInviteUrl(res.data.inviteUrl);
      fetchCreators();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to invite creator');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (creatorId: string, status: 'active' | 'suspended') => {
    try {
      const token = localStorage.getItem('portal_admin_token');
      await axios.put(
        `${API_URL}/api/hub/admin/creators/${creatorId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchCreators();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update status');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" /> Active
          </span>
        );
      case 'invited':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" /> Invited
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" /> Suspended
          </span>
        );
      default:
        return null;
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Godly Hub Creators</h1>
          <p className="text-gray-500">Manage content creators</p>
        </div>
        <button
          onClick={() => {
            setShowInviteModal(true);
            setInviteEmail('');
            setInviteName('');
            setInviteUrl('');
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Invite Creator
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Creators</p>
          <p className="text-2xl font-bold text-gray-900">{creators.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {creators.filter(c => c.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Pending Invites</p>
          <p className="text-2xl font-bold text-yellow-600">
            {creators.filter(c => c.status === 'invited').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Pending Payouts</p>
          <p className="text-2xl font-bold text-purple-600">
            {formatCurrency(creators.reduce((sum, c) => sum + (c.pendingPayoutCents || 0), 0))}
          </p>
        </div>
      </div>

      {/* Creators Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Creator</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Content</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Sales</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Earnings</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Pending</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {creators.map((creator) => (
              <tr key={creator._id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {creator.profileImage ? (
                      <img
                        src={creator.profileImage}
                        alt={creator.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{creator.name}</p>
                      <p className="text-sm text-gray-500">{creator.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">{getStatusBadge(creator.status)}</td>
                <td className="px-6 py-4 text-gray-900">{creator.totalContentCount || 0}</td>
                <td className="px-6 py-4 text-gray-900">{creator.totalSalesCount || 0}</td>
                <td className="px-6 py-4 text-gray-900">
                  {formatCurrency(creator.totalEarningsCents || 0)}
                </td>
                <td className="px-6 py-4">
                  <span className="font-medium text-purple-600">
                    {formatCurrency(creator.pendingPayoutCents || 0)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {creator.status === 'active' && (
                    <button
                      onClick={() => handleStatusChange(creator._id, 'suspended')}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Suspend
                    </button>
                  )}
                  {creator.status === 'suspended' && (
                    <button
                      onClick={() => handleStatusChange(creator._id, 'active')}
                      className="text-sm text-green-600 hover:text-green-700"
                    >
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {creators.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No creators yet</p>
            <p className="text-sm text-gray-400 mt-1">Invite your first creator to get started</p>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Invite Creator</h2>
            
            {!inviteUrl ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Creator Name
                    </label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="creator@example.com"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={sending}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-green-50 rounded-lg p-4 mb-4">
                  <p className="text-green-700 font-medium">Invite created successfully!</p>
                  <p className="text-sm text-green-600 mt-1">
                    Share this link with {inviteName}:
                  </p>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
                  <input
                    type="text"
                    value={inviteUrl}
                    readOnly
                    className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(inviteUrl)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HubCreators;
