import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Plus, Trash2, Save, Video, Image as ImageIcon, BookOpen, Activity, Calendar, Sparkles } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Devotional {
    title?: string;
    content?: string;
    verse?: string;
    verseText?: string;
}

interface QuizQuestion {
    question: string;
    options: Array<{ text: string; isCorrect: boolean }>;
}

interface Activity {
    type: 'quiz' | 'reflection';
    title?: string;
    content?: string; // Legacy: single question
    options?: Array<{ text: string; isCorrect: boolean }>; // Legacy: options for single question
    questions?: QuizQuestion[]; // New: array of questions
    reflectionPrompt?: string;
}

interface LessonFormData {
    title: string;
    description: string;
    type: 'Bible' | 'Science' | 'Math' | 'History' | 'English' | 'Art' | 'Technology';
    video: {
        url: string;
        thumbnail?: string;
        duration?: number;
    };
    devotional: Devotional;
    activity: Activity;
    scheduledDate?: string;
    status: 'draft' | 'scheduled' | 'published' | 'archived';
    coinReward: number;
    order: number;
}

const LessonForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(!!id);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [videoPreview, setVideoPreview] = useState<string>('');
    const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
    const [generatingActivity, setGeneratingActivity] = useState(false);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<LessonFormData>({
        title: '',
        description: '',
        type: 'Bible',
        video: {
            url: '',
            thumbnail: '',
            duration: 0,
        },
        devotional: {
            title: '',
            content: '',
            verse: '',
            verseText: '',
        },
        activity: {
            type: 'quiz',
            title: '',
            questions: [],
        },
        scheduledDate: '',
        status: 'draft',
        coinReward: 50,
        order: 0,
    });

    useEffect(() => {
        if (id) {
            fetchLesson();
        }
    }, [id]);

    const fetchLesson = async () => {
        try {
            const response = await apiClient.get(`/api/lessons/${id}`);
            const lesson = response.data;
            setFormData({
                title: lesson.title || '',
                description: lesson.description || '',
                type: lesson.type || 'Bible',
                video: lesson.video || { url: '', thumbnail: '', duration: 0 },
                devotional: lesson.devotional || { title: '', content: '', verse: '', verseText: '' },
                activity: lesson.activity || { type: 'quiz', questions: [] },
                scheduledDate: lesson.scheduledDate ? (() => {
                    // Parse the date and format as YYYY-MM-DD in local timezone
                    const date = new Date(lesson.scheduledDate);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                })() : '',
                status: lesson.status || 'draft',
                coinReward: lesson.coinReward || 50,
                order: lesson.order || 0,
            });

            if (lesson.video?.url) {
                setVideoPreview(lesson.video.url);
            }
            if (lesson.video?.thumbnail) {
                setThumbnailPreview(lesson.video.thumbnail);
            }
        } catch (error) {
            console.error('Error fetching lesson:', error);
            alert('Failed to load lesson');
        } finally {
            setFetching(false);
        }
    };

    const handleVideoUpload = async (file: File) => {
        if (!file.type.startsWith('video/')) {
            alert('Please select a video file');
            return;
        }

        setUploadingVideo(true);
        setVideoFile(file);
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            const lessonId = id || 'temp';
            const response = await apiClient.post(
                `/api/upload/video?bookId=lessons&type=video&lessonId=${lessonId}`,
                formDataUpload,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }
            );

            setFormData(prev => ({
                ...prev,
                video: { ...prev.video, url: response.data.url },
            }));
            setVideoPreview(response.data.url);

            // Try to get video duration
            const video = document.createElement('video');
            video.src = response.data.url;
            video.onloadedmetadata = () => {
                setFormData(prev => ({
                    ...prev,
                    video: { ...prev.video, duration: Math.floor(video.duration) },
                }));
            };
        } catch (error) {
            console.error('Error uploading video:', error);
            alert('Failed to upload video');
        } finally {
            setUploadingVideo(false);
        }
    };

    const handleThumbnailUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        setUploadingThumbnail(true);
        setThumbnailFile(file);
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            const lessonId = id || 'temp';
            const response = await apiClient.post(
                `/api/upload/image?bookId=lessons&type=thumbnail&lessonId=${lessonId}`,
                formDataUpload,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }
            );

            setFormData(prev => ({
                ...prev,
                video: { ...prev.video, thumbnail: response.data.url },
            }));
            setThumbnailPreview(response.data.url);
        } catch (error) {
            console.error('Error uploading thumbnail:', error);
            alert('Failed to upload thumbnail');
        } finally {
            setUploadingThumbnail(false);
        }
    };



    const handleGenerateActivity = async () => {
        console.log('Generate Activity clicked');
        console.log('Devotional content:', formData.devotional.content);
        console.log('Activity type:', formData.activity.type);

        if (!formData.devotional.content || !formData.devotional.content.trim()) {
            alert('Please add devotional content first before generating an activity.');
            return;
        }

        setGeneratingActivity(true);
        try {
            const payload = {
                devotionalContent: formData.devotional.content,
                activityType: formData.activity.type,
            };

            console.log('Sending request to generate activity:', payload);

            const response = await apiClient.post('/api/lessons/generate-activity', payload);

            console.log('Activity generation response:', response.data);
            const generated = response.data;

            if (formData.activity.type === 'quiz') {
                setFormData(prev => ({
                    ...prev,
                    activity: {
                        type: 'quiz',
                        title: generated.title || prev.activity.title || '',
                        questions: generated.questions || [],
                    },
                }));
                console.log('Updated activity with quiz:', generated);
            } else {
                setFormData(prev => ({
                    ...prev,
                    activity: {
                        type: 'reflection',
                        title: generated.title || prev.activity.title || '',
                        content: generated.content || '',
                    },
                }));
                console.log('Updated activity with reflection:', generated);
            }

            alert('Activity generated successfully!');
        } catch (error: any) {
            console.error('Error generating activity:', error);
            console.error('Error response:', error.response?.data);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to generate activity';
            alert(`Failed to generate activity: ${errorMessage}\n\nMake sure AI_PROVIDER and API key (OPENAI_API_KEY or GEMINI_API_KEY) are set in backend .env file.`);
        } finally {
            setGeneratingActivity(false);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title) {
            alert('Title is required');
            return;
        }

        if (!formData.video.url) {
            alert('Video is required');
            return;
        }

        if (formData.activity.type === 'quiz') {
            if (!formData.activity.questions || formData.activity.questions.length === 0) {
                alert('Quiz must have at least one question');
                return;
            }
            // Validate each question
            for (let i = 0; i < formData.activity.questions.length; i++) {
                const q = formData.activity.questions[i];
                if (!q.question || !q.question.trim()) {
                    alert(`Question ${i + 1} must have text`);
                    return;
                }
                if (!q.options || q.options.length < 2) {
                    alert(`Question ${i + 1} must have at least 2 options`);
                    return;
                }
                if (!q.options.some(opt => opt.isCorrect)) {
                    alert(`Question ${i + 1} must have at least one correct answer`);
                    return;
                }
            }
        } else {
            if (!formData.activity.content) {
                alert('Reflection prompt is required');
                return;
            }
        }

        setLoading(true);

        try {
            const payload = {
                ...formData,
                scheduledDate: formData.scheduledDate ? (() => {
                    // Create date at midnight UTC to avoid timezone shifts
                    const dateStr = formData.scheduledDate; // Format: YYYY-MM-DD
                    return `${dateStr}T00:00:00.000Z`;
                })() : undefined,
            };

            let lessonId = id;

            if (id) {
                await apiClient.put(`/api/lessons/${id}`, payload);
            } else {
                const response = await apiClient.post('/api/lessons', payload);
                lessonId = response.data._id;

                // Ensure lessonId is defined before using it
                if (!lessonId) {
                    throw new Error('Failed to create lesson: no ID returned');
                }

                // If we uploaded files with temp ID, re-upload with real lesson ID
                if (videoFile && formData.video.url && !formData.video.url.includes(lessonId)) {
                    const formDataUpload = new FormData();
                    formDataUpload.append('file', videoFile);
                    const uploadResponse = await apiClient.post(
                        `/api/upload/video?bookId=lessons&type=video&lessonId=${lessonId}`,
                        formDataUpload,
                        { headers: { 'Content-Type': 'multipart/form-data' } }
                    );
                    await apiClient.put(`/api/lessons/${lessonId}`, {
                        video: { ...formData.video, url: uploadResponse.data.url },
                    });
                }

                if (thumbnailFile && formData.video.thumbnail && typeof formData.video.thumbnail === 'string' && !formData.video.thumbnail.includes(lessonId)) {
                    const formDataUpload = new FormData();
                    formDataUpload.append('file', thumbnailFile);
                    const uploadResponse = await apiClient.post(
                        `/api/upload/image?bookId=lessons&type=thumbnail&lessonId=${lessonId}`,
                        formDataUpload,
                        { headers: { 'Content-Type': 'multipart/form-data' } }
                    );
                    await apiClient.put(`/api/lessons/${lessonId}`, {
                        video: { ...formData.video, thumbnail: uploadResponse.data.url },
                    });
                }
            }
            navigate('/lessons');
        } catch (error: any) {
            console.error('Error saving lesson:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to save lesson';
            alert(`Failed to save lesson: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return <div className="p-6 text-center">Loading lesson...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/lessons')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-3xl font-bold text-gray-800">
                    {id ? 'Edit Lesson' : 'Create New Lesson'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-8">
                {/* Basic Information */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Basic Information</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Lesson Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="Bible">Bible</option>
                            <option value="Science">Science</option>
                            <option value="Math">Math</option>
                            <option value="History">History</option>
                            <option value="English">English</option>
                            <option value="Art">Art</option>
                            <option value="Technology">Technology</option>
                        </select>
                    </div>
                </div>

                {/* Video Upload */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                        <Video className="w-5 h-5" />
                        Video Content
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Video Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Video *</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                {videoPreview ? (
                                    <div className="relative">
                                        <video src={videoPreview} controls className="w-full rounded-lg max-h-64" />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setVideoPreview('');
                                                setFormData(prev => ({ ...prev, video: { ...prev.video, url: '' } }));
                                            }}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            ref={videoInputRef}
                                            type="file"
                                            accept="video/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleVideoUpload(file);
                                            }}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => videoInputRef.current?.click()}
                                            disabled={uploadingVideo}
                                            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 transition-colors disabled:opacity-50"
                                        >
                                            {uploadingVideo ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                                    Uploading...
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Upload className="w-8 h-8 text-gray-400" />
                                                    <span className="text-sm text-gray-600">Click to upload video</span>
                                                </div>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Thumbnail Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                {thumbnailPreview ? (
                                    <div className="relative">
                                        <img src={thumbnailPreview} alt="Thumbnail" className="w-full rounded-lg max-h-64 object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setThumbnailPreview('');
                                                setFormData(prev => ({ ...prev, video: { ...prev.video, thumbnail: '' } }));
                                            }}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            ref={thumbnailInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleThumbnailUpload(file);
                                            }}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => thumbnailInputRef.current?.click()}
                                            disabled={uploadingThumbnail}
                                            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 transition-colors disabled:opacity-50"
                                        >
                                            {uploadingThumbnail ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                                    Uploading...
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <ImageIcon className="w-8 h-8 text-gray-400" />
                                                    <span className="text-sm text-gray-600">Click to upload thumbnail</span>
                                                </div>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Devotional Editor */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Devotional (Screen 2)
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Devotional Title</label>
                        <input
                            type="text"
                            value={formData.devotional.title || ''}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                devotional: { ...prev.devotional, title: e.target.value },
                            }))}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Devotional Content</label>
                        <textarea
                            value={formData.devotional.content || ''}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                devotional: { ...prev.devotional, content: e.target.value },
                            }))}
                            rows={5}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter devotional content..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Bible Verse Reference</label>
                            <input
                                type="text"
                                value={formData.devotional.verse || ''}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    devotional: { ...prev.devotional, verse: e.target.value },
                                }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="e.g., John 3:16"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Verse Text</label>
                            <textarea
                                value={formData.devotional.verseText || ''}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    devotional: { ...prev.devotional, verseText: e.target.value },
                                }))}
                                rows={2}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Enter full verse text..."
                            />
                        </div>
                    </div>
                </div>

                {/* Activity Editor */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                            <Activity className="w-5 h-5" />
                            Activity (Screen 3)
                        </h2>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({
                                    ...prev,
                                    activity: { ...prev.activity, type: 'quiz', questions: prev.activity.questions || [] },
                                }))}
                                className={`px-4 py-2 rounded-lg transition-colors ${formData.activity.type === 'quiz'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Quiz
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({
                                    ...prev,
                                    activity: { ...prev.activity, type: 'reflection' },
                                }))}
                                className={`px-4 py-2 rounded-lg transition-colors ${formData.activity.type === 'reflection'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Reflection
                            </button>
                        </div>
                    </div>

                    {/* AI Generate Button */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-indigo-900 mb-1">AI-Powered Activity Generation</h3>
                                <p className="text-xs text-indigo-700">
                                    Generate {formData.activity.type === 'quiz' ? 'quiz questions' : 'reflection prompts'} automatically from your devotional content
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    console.log('Button clicked, devotional content:', formData.devotional.content);
                                    handleGenerateActivity();
                                }}
                                disabled={generatingActivity || !formData.devotional.content || !formData.devotional.content.trim()}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {generatingActivity ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Generate Activity
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Activity Title</label>
                        <input
                            type="text"
                            value={formData.activity.title || ''}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                activity: { ...prev.activity, title: e.target.value },
                            }))}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {formData.activity.type === 'quiz' ? (
                        <div className="space-y-6">
                            {formData.activity.questions && formData.activity.questions.length > 0 ? (
                                formData.activity.questions.map((quizQuestion, questionIndex) => (
                                    <div key={questionIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-sm font-semibold text-gray-700">Question {questionIndex + 1}</h4>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        activity: {
                                                            ...prev.activity,
                                                            questions: prev.activity.questions?.filter((_, i) => i !== questionIndex) || []
                                                        }
                                                    }));
                                                }}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Question Text *</label>
                                            <textarea
                                                value={quizQuestion.question}
                                                onChange={(e) => {
                                                    const newQuestions = [...(formData.activity.questions || [])];
                                                    newQuestions[questionIndex] = {
                                                        ...newQuestions[questionIndex],
                                                        question: e.target.value
                                                    };
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        activity: { ...prev.activity, questions: newQuestions }
                                                    }));
                                                }}
                                                rows={2}
                                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="Enter question text..."
                                                required
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-sm font-medium text-gray-700">Answer Options *</label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newQuestions = [...(formData.activity.questions || [])];
                                                        newQuestions[questionIndex] = {
                                                            ...newQuestions[questionIndex],
                                                            options: [...(newQuestions[questionIndex].options || []), { text: '', isCorrect: false }]
                                                        };
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            activity: { ...prev.activity, questions: newQuestions }
                                                        }));
                                                    }}
                                                    className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Add Option
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {quizQuestion.options?.map((option, optionIndex) => (
                                                    <div key={optionIndex} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                                                        <input
                                                            type="checkbox"
                                                            checked={option.isCorrect}
                                                            onChange={(e) => {
                                                                const newQuestions = [...(formData.activity.questions || [])];
                                                                const newOptions = [...(newQuestions[questionIndex].options || [])];
                                                                newOptions[optionIndex] = { ...newOptions[optionIndex], isCorrect: e.target.checked };
                                                                newQuestions[questionIndex] = { ...newQuestions[questionIndex], options: newOptions };
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    activity: { ...prev.activity, questions: newQuestions }
                                                                }));
                                                            }}
                                                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={option.text}
                                                            onChange={(e) => {
                                                                const newQuestions = [...(formData.activity.questions || [])];
                                                                const newOptions = [...(newQuestions[questionIndex].options || [])];
                                                                newOptions[optionIndex] = { ...newOptions[optionIndex], text: e.target.value };
                                                                newQuestions[questionIndex] = { ...newQuestions[questionIndex], options: newOptions };
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    activity: { ...prev.activity, questions: newQuestions }
                                                                }));
                                                            }}
                                                            placeholder={`Option ${optionIndex + 1}`}
                                                            className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        />
                                                        {quizQuestion.options && quizQuestion.options.length > 2 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newQuestions = [...(formData.activity.questions || [])];
                                                                    newQuestions[questionIndex] = {
                                                                        ...newQuestions[questionIndex],
                                                                        options: newQuestions[questionIndex].options?.filter((_, i) => i !== optionIndex) || []
                                                                    };
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        activity: { ...prev.activity, questions: newQuestions }
                                                                    }));
                                                                }}
                                                                className="text-red-600 hover:text-red-800"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                                    No questions yet. Click "Generate Activity" to create quiz questions from devotional content.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Reflection Prompt *</label>
                            <textarea
                                value={formData.activity.content}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    activity: { ...prev.activity, content: e.target.value },
                                }))}
                                rows={5}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Enter reflection prompt or question..."
                                required
                            />
                        </div>
                    )}
                </div>

                {/* Settings */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Settings
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Date</label>
                            <input
                                type="date"
                                value={formData.scheduledDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="draft">Draft</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="published">Published</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Coin Reward</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.coinReward}
                                onChange={(e) => setFormData(prev => ({ ...prev, coinReward: parseInt(e.target.value) || 0 }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                            <input
                                type="number"
                                value={formData.order}
                                onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-4 pt-6 border-t">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-5 h-5" />
                        {loading ? 'Saving...' : 'Save Lesson'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/lessons')}
                        className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LessonForm;

