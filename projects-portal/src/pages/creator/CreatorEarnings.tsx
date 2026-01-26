import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

interface Sale {
  _id: string;
  createdAt: string;
  amount: number;
  creatorEarningsCents: number;
  relatedPlaylistId?: {
    title: string;
  };
}

interface PlaylistSales {
  _id: string;
  title: string;
  purchaseCount: number;
  totalTokensEarned: number;
}

const CreatorEarnings: React.FC = () => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalEarningsCents, setTotalEarningsCents] = useState(0);
  const [pendingPayoutCents, setPendingPayoutCents] = useState(0);
  const [totalPaidOutCents, setTotalPaidOutCents] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [salesByPlaylist, setSalesByPlaylist] = useState<PlaylistSales[]>([]);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const token = getToken();
      const res = await axios.get(`${API_URL}/api/hub/my-earnings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTotalEarningsCents(res.data.totalEarningsCents || 0);
      setPendingPayoutCents(res.data.pendingPayoutCents || 0);
      setTotalPaidOutCents(res.data.totalPaidOutCents || 0);
      setTotalSalesCount(res.data.totalSalesCount || 0);
      setRecentSales(res.data.recentSales || []);
      setSalesByPlaylist(res.data.salesByPlaylist || []);
    } catch (error) {
      console.error('Error fetching earnings:', error);
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
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
        <p className="text-gray-500">Track your revenue and payouts</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalEarningsCents)}
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
                {formatCurrency(pendingPayoutCents)}
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Payouts processed monthly
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Paid Out</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalPaidOutCents)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{totalSalesCount}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Sales by Content</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {salesByPlaylist.filter(p => p.purchaseCount > 0).map((playlist) => (
              <div key={playlist._id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{playlist.title}</p>
                  <p className="text-sm text-gray-500">
                    {playlist.purchaseCount} sales · {playlist.totalTokensEarned} tokens
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">
                    {formatCurrency(Math.round(playlist.totalTokensEarned * 54))}
                  </p>
                </div>
              </div>
            ))}
            {salesByPlaylist.filter(p => p.purchaseCount > 0).length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No sales yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
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
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No transactions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payout Info */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Payout Information</h3>
            <p className="text-indigo-100 mt-1">
              Payouts are processed monthly. Make sure your payout details are up to date in your profile.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-indigo-200">Minimum payout</p>
            <p className="text-2xl font-bold">$25.00</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorEarnings;
