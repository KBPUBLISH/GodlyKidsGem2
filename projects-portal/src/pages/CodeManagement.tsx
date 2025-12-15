import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, ExternalLink, Copy, Check, X, BarChart2 } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Influencer {
    _id: string;
    name: string;
    code: string;
    email: string;
    commissionPercent: number;
    discountPercent: number;
    trialDays: number;
    stripePromoCode: string; // Stripe coupon/promo code for discounts
    isActive: boolean;
    stats: {
        clicks: number;
        signups: number;
        conversions: number;
        totalRevenue: number;
    };
    createdAt: string;
}

interface FormData {
    name: string;
    code: string;
    email: string;
    commissionPercent: number;
    discountPercent: number;
    trialDays: number;
    stripePromoCode: string;
    notes: string;
}

const defaultFormData: FormData = {
    name: '',
    code: '',
    email: '',
    commissionPercent: 10,
    discountPercent: 25,
    trialDays: 7,
    stripePromoCode: '',
    notes: ''
};

const CodeManagement: React.FC = () => {
    const [influencers, setInfluencers] = useState<Influencer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
    
    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData>(defaultFormData);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    
    // Stats modal
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [selectedStats, setSelectedStats] = useState<any>(null);
    
    // Copy feedback
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const appUrl = 'https://app.godlykids.com';

    useEffect(() => {
        fetchInfluencers();
    }, [filterActive, search]);

    const fetchInfluencers = async () => {
        setLoading(true);
        try {
            let url = '/api/influencers?';
            if (filterActive === 'active') url += 'active=true&';
            if (filterActive === 'inactive') url += 'active=false&';
            if (search) url += `search=${encodeURIComponent(search)}&`;
            
            const response = await apiClient.get(url);
            setInfluencers(response.data);
        } catch (error) {
            console.error('Failed to fetch influencers:', error);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingId(null);
        setFormData(defaultFormData);
        setFormError(null);
        setShowModal(true);
    };

    const openEditModal = (influencer: Influencer) => {
        setEditingId(influencer._id);
        setFormData({
            name: influencer.name,
            code: influencer.code,
            email: influencer.email,
            commissionPercent: influencer.commissionPercent,
            discountPercent: influencer.discountPercent,
            trialDays: influencer.trialDays,
            stripePromoCode: influencer.stripePromoCode || '',
            notes: ''
        });
        setFormError(null);
        setShowModal(true);
    };

    const handleSave = async () => {
        setFormError(null);
        
        if (!formData.name || !formData.code || !formData.email) {
            setFormError('Name, code, and email are required');
            return;
        }

        setSaving(true);
        try {
            if (editingId) {
                await apiClient.put(`/api/influencers/${editingId}`, formData);
            } else {
                await apiClient.post('/api/influencers', formData);
            }
            setShowModal(false);
            fetchInfluencers();
        } catch (error: any) {
            setFormError(error.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (!confirm(`Are you sure you want to deactivate the code "${code}"?`)) {
            return;
        }

        try {
            await apiClient.delete(`/api/influencers/${id}`);
            fetchInfluencers();
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const viewStats = async (id: string) => {
        try {
            const response = await apiClient.get(`/api/influencers/${id}/stats`);
            setSelectedStats(response.data);
            setShowStatsModal(true);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const copyLink = (code: string) => {
        const link = `${appUrl}/#/ref/${code}`;
        navigator.clipboard.writeText(link);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const getConversionRate = (stats: Influencer['stats']) => {
        if (stats.signups === 0) return '0%';
        return ((stats.conversions / stats.signups) * 100).toFixed(1) + '%';
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Code Management</h1>
                    <p className="text-gray-600">Manage influencer referral codes and track performance</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Code
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, code, or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
                <select
                    value={filterActive}
                    onChange={(e) => setFilterActive(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="all">All Codes</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : influencers.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No influencer codes found. Create one to get started!
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Clicks</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Signups</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Conv.</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Revenue</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {influencers.map((inf) => (
                                <tr key={inf._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-indigo-600">{inf.code}</span>
                                            <button
                                                onClick={() => copyLink(inf.code)}
                                                className="p-1 text-gray-400 hover:text-gray-600"
                                                title="Copy referral link"
                                            >
                                                {copiedCode === inf.code ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div>
                                            <div className="font-medium text-gray-900">{inf.name}</div>
                                            <div className="text-sm text-gray-500">{inf.email}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-gray-600">{inf.stats.clicks.toLocaleString()}</td>
                                    <td className="px-4 py-4 text-gray-600">{inf.stats.signups.toLocaleString()}</td>
                                    <td className="px-4 py-4 text-gray-600">{inf.stats.conversions.toLocaleString()}</td>
                                    <td className="px-4 py-4 text-gray-600">${inf.stats.totalRevenue.toLocaleString()}</td>
                                    <td className="px-4 py-4 text-gray-600">{getConversionRate(inf.stats)}</td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            inf.isActive 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {inf.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => viewStats(inf._id)}
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                title="View stats"
                                            >
                                                <BarChart2 className="w-4 h-4" />
                                            </button>
                                            <a
                                                href={`${appUrl}/#/ref/${inf.code}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                title="Open landing page"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                            <button
                                                onClick={() => openEditModal(inf)}
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(inf._id, inf.code)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                title="Deactivate"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">
                                {editingId ? 'Edit Influencer Code' : 'Create New Code'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Sarah Smith"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                                    placeholder="SARAH"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Link: {appUrl}/#/ref/{formData.code || 'CODE'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="sarah@example.com"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Commission %</label>
                                    <input
                                        type="number"
                                        value={formData.commissionPercent}
                                        onChange={(e) => setFormData({ ...formData, commissionPercent: parseInt(e.target.value) || 0 })}
                                        min="0"
                                        max="100"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                                    <input
                                        type="number"
                                        value={formData.discountPercent}
                                        onChange={(e) => setFormData({ ...formData, discountPercent: parseInt(e.target.value) || 0 })}
                                        min="0"
                                        max="100"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Trial Days</label>
                                    <input
                                        type="number"
                                        value={formData.trialDays}
                                        onChange={(e) => setFormData({ ...formData, trialDays: parseInt(e.target.value) || 0 })}
                                        min="0"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Promo Code</label>
                                <input
                                    type="text"
                                    value={formData.stripePromoCode}
                                    onChange={(e) => setFormData({ ...formData, stripePromoCode: e.target.value.toUpperCase() })}
                                    placeholder="e.g., SARAH25OFF"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Create this code in Stripe Dashboard → Products → Coupons
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={2}
                                    placeholder="Optional notes..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {formError && (
                                <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm">
                                    {formError}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Code'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Modal */}
            {showStatsModal && selectedStats && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-lg w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold">{selectedStats.influencer.name}</h2>
                                <p className="text-gray-600 font-mono">{selectedStats.influencer.code}</p>
                            </div>
                            <button
                                onClick={() => setShowStatsModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-gray-900">{selectedStats.stats.clicks.toLocaleString()}</div>
                                <div className="text-sm text-gray-600">Total Clicks</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-gray-900">{selectedStats.stats.signups.toLocaleString()}</div>
                                <div className="text-sm text-gray-600">Signups</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-gray-900">{selectedStats.stats.conversions.toLocaleString()}</div>
                                <div className="text-sm text-gray-600">Conversions</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-green-600">${selectedStats.stats.totalRevenue.toLocaleString()}</div>
                                <div className="text-sm text-gray-600">Total Revenue</div>
                            </div>
                        </div>

                        <div className="bg-indigo-50 rounded-lg p-4 mb-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="text-sm text-indigo-600 font-medium">Estimated Commission ({selectedStats.influencer.commissionPercent}%)</div>
                                    <div className="text-2xl font-bold text-indigo-700">${selectedStats.stats.estimatedCommission.toLocaleString()}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-600">Conversion Rate</div>
                                    <div className="text-xl font-bold text-gray-900">{selectedStats.stats.conversionRate}</div>
                                </div>
                            </div>
                        </div>

                        {selectedStats.referredUsers && selectedStats.referredUsers.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Recent Signups</h3>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {selectedStats.referredUsers.slice(0, 10).map((user: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 rounded px-3 py-2">
                                            <span className="text-gray-600">{user.email}</span>
                                            <span className={user.isPremium ? 'text-green-600' : 'text-gray-400'}>
                                                {user.isPremium ? '✓ Subscribed' : 'Free'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setShowStatsModal(false)}
                            className="w-full mt-6 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CodeManagement;

