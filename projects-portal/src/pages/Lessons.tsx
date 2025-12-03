import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Calendar, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';

interface Lesson {
    _id: string;
    title: string;
    description?: string;
    status: 'draft' | 'scheduled' | 'published' | 'archived';
    video?: {
        url?: string;
        thumbnail?: string;
        duration?: number;
    };
    type?: string;
    scheduledDate?: string;
    coinReward?: number;
    order?: number;
}

const Lessons: React.FC = () => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        fetchLessons();
    }, [statusFilter]);

    const fetchLessons = async () => {
        try {
            const url = statusFilter === 'all'
                ? '/api/lessons'
                : `/api/lessons?status=${statusFilter}`;
            const response = await apiClient.get(url);
            setLessons(response.data);
        } catch (error) {
            console.error('Error fetching lessons:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteLesson = async (lessonId: string, lessonTitle: string) => {
        if (!window.confirm(`Are you sure you want to delete "${lessonTitle}"? This action cannot be undone.`)) {
            return;
        }

        setDeletingLessonId(lessonId);
        try {
            await apiClient.delete(`/api/lessons/${lessonId}`);
            setLessons(lessons.filter(lesson => lesson._id !== lessonId));
        } catch (error) {
            console.error('Error deleting lesson:', error);
            alert('Failed to delete lesson. Please try again.');
        } finally {
            setDeletingLessonId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published':
                return 'bg-green-100 text-green-800';
            case 'scheduled':
                return 'bg-blue-100 text-blue-800';
            case 'draft':
                return 'bg-gray-100 text-gray-800';
            case 'archived':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Not scheduled';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Video Lessons</h1>
                <Link
                    to="/lessons/new"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Lesson
                </Link>
            </div>

            {/* Status Filter */}
            <div className="mb-6 flex gap-2">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    All
                </button>
                <button
                    onClick={() => setStatusFilter('draft')}
                    className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'draft'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Draft
                </button>
                <button
                    onClick={() => setStatusFilter('scheduled')}
                    className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'scheduled'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Scheduled
                </button>
                <button
                    onClick={() => setStatusFilter('published')}
                    className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'published'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Published
                </button>
            </div>

            {loading ? (
                <p>Loading lessons...</p>
            ) : lessons.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
                    <p className="text-gray-500">No lessons found. Create your first one!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lessons.map((lesson) => (
                        <div key={lesson._id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between h-full">
                            <div>
                                {lesson.video?.thumbnail ? (
                                    <div className="mb-4 rounded-lg overflow-hidden">
                                        <img
                                            src={lesson.video.thumbnail}
                                            alt={lesson.title}
                                            className="w-full h-48 object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 h-48 flex items-center justify-center">
                                        <Video className="w-12 h-12 text-gray-400" />
                                    </div>
                                )}

                                <h3 className="text-xl font-bold text-gray-800 mb-2">{lesson.title}</h3>

                                {lesson.description && (
                                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{lesson.description}</p>
                                )}

                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(lesson.status)}`}>
                                        {lesson.status}
                                    </span>
                                    <span className="px-2 py-1 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                                        {lesson.type || 'Bible'}
                                    </span>
                                    {lesson.coinReward && (
                                        <span className="text-xs text-gray-500">
                                            🪙 {lesson.coinReward} coins
                                        </span>
                                    )}
                                </div>
                                {
                                    lesson.scheduledDate && (
                                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
                                            <Calendar className="w-4 h-4" />
                                            {formatDate(lesson.scheduledDate)}
                                        </div>
                                    )
                                }
                            </div >

                            <div className="flex gap-2 mt-4">
                                <Link
                                    to={`/lessons/edit/${lesson._id}`}
                                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-center hover:bg-indigo-700 transition-colors"
                                >
                                    <Edit className="w-4 h-4 inline mr-1" />
                                    Edit
                                </Link>
                                <button
                                    onClick={() => handleDeleteLesson(lesson._id, lesson.title)}
                                    disabled={deletingLessonId === lesson._id}
                                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {deletingLessonId === lesson._id ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></div>
                                    ) : (
                                        <Trash2 className="w-4 h-4 inline" />
                                    )}
                                </button>
                            </div>
                        </div >
                    ))}
                </div >
            )}
        </div >
    );
};

export default Lessons;
