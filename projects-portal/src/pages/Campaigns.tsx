import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Heart, Target, Users, TrendingUp, Edit, Trash2, RotateCcw, Eye, EyeOff, Camera } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Campaign {
    _id: string;
    title: string;
    description: string;
    image?: string;
    goalCoins: number;
    currentCoins: number;
    totalDonations: number;
    totalGoalsReached: number;
    isRecurring: boolean;
    isActive: boolean;
    category: string;
    sortOrder: number;
    progressPercent: number;
    createdAt: string;
}

interface Stats {
    totalCampaigns: number;
    activeCampaigns: number;
    totalGoalsReached: number;
    totalDonations: number;
}

const Campaigns: React.FC = () => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCampaigns();
        fetchStats();
    }, []);

    const fetchCampaigns = async () => {
        try {
            const response = await apiClient.get('/api/campaigns/all');
            setCampaigns(response.data);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await apiClient.get('/api/campaigns/stats/summary');
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleToggleActive = async (campaign: Campaign) => {
        try {
            await apiClient.put(`/api/campaigns/${campaign._id}`, {
                isActive: !campaign.isActive
            });
            fetchCampaigns();
        } catch (error) {
            console.error('Error toggling campaign:', error);
        }
    };

    const handleReset = async (campaign: Campaign) => {
        if (!confirm(`Reset "${campaign.title}" progress to 0 coins?`)) return;
        
        try {
            await apiClient.post(`/api/campaigns/${campaign._id}/reset`);
            fetchCampaigns();
        } catch (error) {
            console.error('Error resetting campaign:', error);
        }
    };

    const handleDelete = async (campaign: Campaign) => {
        if (!confirm(`Delete "${campaign.title}"? This cannot be undone.`)) return;
        
        try {
            await apiClient.delete(`/api/campaigns/${campaign._id}`);
            fetchCampaigns();
            fetchStats();
        } catch (error) {
            console.error('Error deleting campaign:', error);
        }
    };

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            clothing: 'bg-blue-100 text-blue-700',
            food: 'bg-green-100 text-green-700',
            hygiene: 'bg-purple-100 text-purple-700',
            shelter: 'bg-orange-100 text-orange-700',
            education: 'bg-yellow-100 text-yellow-700',
            other: 'bg-gray-100 text-gray-700',
        };
        return colors[category] || colors.other;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Giving Campaigns</h1>
                    <p className="text-gray-500">Manage crowdfunding campaigns for outreach</p>
                </div>
                <Link
                    to="/campaigns/new"
                    className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Campaign
                </Link>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-pink-100 rounded-lg">
                                <Heart className="w-5 h-5 text-pink-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Active Campaigns</p>
                                <p className="text-xl font-bold text-gray-800">{stats.activeCampaigns}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Target className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Goals Reached</p>
                                <p className="text-xl font-bold text-gray-800">{stats.totalGoalsReached}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Donations</p>
                                <p className="text-xl font-bold text-gray-800">{stats.totalDonations}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Campaigns</p>
                                <p className="text-xl font-bold text-gray-800">{stats.totalCampaigns}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {campaigns.length === 0 ? (
                    <div className="p-12 text-center">
                        <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-600 mb-2">No campaigns yet</h3>
                        <p className="text-gray-400 mb-4">Create your first giving campaign</p>
                        <Link
                            to="/campaigns/new"
                            className="inline-flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700"
                        >
                            <Plus className="w-5 h-5" />
                            Create Campaign
                        </Link>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Campaign</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Progress</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Goals</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Donations</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Type</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {campaigns.map((campaign) => (
                                <tr key={campaign._id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            {campaign.image ? (
                                                <img 
                                                    src={campaign.image} 
                                                    alt={campaign.title}
                                                    className="w-12 h-12 rounded-lg object-cover"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-pink-100 flex items-center justify-center">
                                                    <Heart className="w-6 h-6 text-pink-500" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-800">{campaign.title}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(campaign.category)}`}>
                                                    {campaign.category}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-pink-500 rounded-full transition-all"
                                                    style={{ width: `${campaign.progressPercent}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-500">
                                                {campaign.currentCoins} / {campaign.goalCoins}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="font-semibold text-green-600">{campaign.totalGoalsReached}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="text-gray-600">{campaign.totalDonations}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            campaign.isRecurring 
                                                ? 'bg-blue-100 text-blue-700' 
                                                : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            {campaign.isRecurring ? 'Recurring' : 'One-off'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            campaign.isActive 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {campaign.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                to={`/campaigns/${campaign._id}/updates`}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                title="Manage Updates"
                                            >
                                                <Camera className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => handleToggleActive(campaign)}
                                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                                title={campaign.isActive ? 'Deactivate' : 'Activate'}
                                            >
                                                {campaign.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => handleReset(campaign)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                title="Reset progress"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                            <Link
                                                to={`/campaigns/${campaign._id}/edit`}
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(campaign)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                title="Delete"
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
        </div>
    );
};

export default Campaigns;
