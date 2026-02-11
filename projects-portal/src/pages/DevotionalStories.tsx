import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Book, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';

interface DevotionalStory {
    _id: string;
    title: string;
    displayTitle: string;
    description?: string;
    scripture: string;
    status: 'draft' | 'published' | 'archived';
    ageGroups: string[];
    goalTags: string[];
    estimatedDuration: number;
    playCount: number;
    backgroundMusicUrl?: string;
    createdAt: string;
}

const DevotionalStories: React.FC = () => {
    const [stories, setStories] = useState<DevotionalStory[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [ageFilter, setAgeFilter] = useState<string>('all');
    const [goalFilter, setGoalFilter] = useState<string>('all');

    useEffect(() => {
        fetchStories();
    }, [statusFilter, ageFilter, goalFilter]);

    const fetchStories = async () => {
        try {
            let url = '/api/devotional-stories?';
            if (statusFilter !== 'all') url += `status=${statusFilter}&`;
            if (ageFilter !== 'all') url += `ageGroup=${ageFilter}&`;
            if (goalFilter !== 'all') url += `goalTag=${goalFilter}&`;
            
            const response = await apiClient.get(url);
            setStories(response.data.stories || []);
        } catch (error) {
            console.error('Error fetching stories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteStory = async (storyId: string, storyTitle: string) => {
        if (!window.confirm(`Are you sure you want to delete "${storyTitle}"? This action cannot be undone.`)) {
            return;
        }

        setDeletingStoryId(storyId);
        try {
            await apiClient.delete(`/api/devotional-stories/${storyId}`);
            setStories(stories.filter(story => story._id !== storyId));
        } catch (error) {
            console.error('Error deleting story:', error);
            alert('Failed to delete story. Please try again.');
        } finally {
            setDeletingStoryId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published':
                return 'bg-green-100 text-green-800';
            case 'draft':
                return 'bg-gray-100 text-gray-800';
            case 'archived':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const goalTagLabels: Record<string, string> = {
        courage: '💪 Courage',
        faith: '🙏 Faith',
        gratitude: '🙏 Gratitude',
        love: '❤️ Love',
        obedience: '📖 Obedience',
        'self-control': '🧘 Self-Control',
        theology: '✝️ Theology',
        wisdom: '🦉 Wisdom',
    };

    const ageGroupLabels: Record<string, string> = {
        '4-6': '4-6 years',
        '6-8': '6-8 years',
        '8-10': '8-10 years',
        '10-12': '10-12 years',
        'all': 'All ages',
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Devotional Stories</h1>
                    <p className="text-gray-600 mt-1">
                        Personalized stories with {'{childName}'} placeholders for the lesson experience
                    </p>
                </div>
                <Link
                    to="/devotional-stories/new"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Story
                </Link>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-4">
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>

                {/* Age Group Filter */}
                <select
                    value={ageFilter}
                    onChange={(e) => setAgeFilter(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                >
                    <option value="all">All Ages</option>
                    <option value="4-6">4-6 years</option>
                    <option value="6-8">6-8 years</option>
                    <option value="8-10">8-10 years</option>
                    <option value="10-12">10-12 years</option>
                </select>

                {/* Goal Tag Filter */}
                <select
                    value={goalFilter}
                    onChange={(e) => setGoalFilter(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                >
                    <option value="all">All Goals</option>
                    <option value="courage">Courage</option>
                    <option value="faith">Faith</option>
                    <option value="gratitude">Gratitude</option>
                    <option value="love">Love</option>
                    <option value="obedience">Obedience</option>
                    <option value="self-control">Self-Control</option>
                    <option value="theology">Theology</option>
                    <option value="wisdom">Wisdom</option>
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : stories.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Book className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No stories yet</h3>
                    <p className="text-gray-500 mb-4">Create your first personalized devotional story</p>
                    <Link
                        to="/devotional-stories/new"
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        <Plus className="w-5 h-5" />
                        Create Story
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Story
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Scripture
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Age Groups
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Goals
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Plays
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stories.map((story) => (
                                <tr key={story._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 rounded-lg">
                                                <Book className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {story.title}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    ~{story.estimatedDuration} min
                                                    {story.backgroundMusicUrl && ' • 🎵'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {story.scripture}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {story.ageGroups.map((age) => (
                                                <span
                                                    key={age}
                                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                                                >
                                                    {ageGroupLabels[age] || age}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {story.goalTags.slice(0, 2).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded"
                                                >
                                                    {goalTagLabels[tag] || tag}
                                                </span>
                                            ))}
                                            {story.goalTags.length > 2 && (
                                                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                                    +{story.goalTags.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(story.status)}`}>
                                            {story.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {story.playCount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                to={`/devotional-stories/${story._id}`}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit className="w-5 h-5" />
                                            </Link>
                                            <button
                                                onClick={() => handleDeleteStory(story._id, story.title)}
                                                disabled={deletingStoryId === story._id}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                title="Delete"
                                            >
                                                {deletingStoryId === story._id ? (
                                                    <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DevotionalStories;
