import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, Music, Eye, Sparkles, Plus, Trash2, Book, HelpCircle, Image, RefreshCw } from 'lucide-react';
import apiClient from '../services/apiClient';

interface ReflectionQuestion {
    question: string;
    parentTip: string;
    emoji: string;
}

interface StoryFormData {
    title: string;
    displayTitle: string;
    description: string;
    scripture: string;
    scriptureText: string;
    content: string;
    ageGroups: string[];
    goalTags: string[];
    backgroundMusicUrl: string;
    estimatedDuration: number;
    coverPrompt: string;
    defaultCoverUrl: string;
    sceneImageUrl: string;
    sceneImagePrompt: string;
    status: 'draft' | 'published' | 'archived';
    reflectionQuestions: ReflectionQuestion[];
    preferredVoice: string;
}

// ElevenLabs voices for story narration
const VOICES = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', description: 'Calm, warm' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female', description: 'Soft, friendly' },
    { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'female', description: 'Expressive, youthful' },
    { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'female', description: 'Warm, nurturing' },
    { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace', gender: 'female', description: 'Gentle, soothing' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male', description: 'Deep, warm' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male', description: 'Young, energetic' },
    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', description: 'British, clear' },
    { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', gender: 'male', description: 'Hoarse, storyteller' },
];
const AGE_GROUPS = ['4-6', '6-8', '8-10', '10-12', 'all'];
const GOAL_TAGS = ['courage', 'faith', 'gratitude', 'love', 'obedience', 'self-control', 'theology', 'wisdom'];

const EMOJIS = ['📖', '✨', '🙏', '❤️', '🌟', '💪', '🎯', '🌈', '☀️', '🕊️'];

const DevotionalStoryForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(!!id);
    const [uploadingMusic, setUploadingMusic] = useState(false);
    const [generatingScene, setGeneratingScene] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const musicInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<StoryFormData>({
        title: '',
        displayTitle: '',
        description: '',
        scripture: '',
        scriptureText: '',
        content: '',
        ageGroups: ['all'],
        goalTags: [],
        backgroundMusicUrl: '',
        estimatedDuration: 3,
        coverPrompt: '',
        defaultCoverUrl: '',
        sceneImageUrl: '',
        sceneImagePrompt: '',
        status: 'draft',
        reflectionQuestions: [],
        preferredVoice: '',
    });

    useEffect(() => {
        if (id && id !== 'new') {
            fetchStory();
        } else {
            setFetching(false);
        }
    }, [id]);

    const fetchStory = async () => {
        try {
            const response = await apiClient.get(`/api/devotional-stories/${id}`);
            const story = response.data.story;
            setFormData({
                title: story.title || '',
                displayTitle: story.displayTitle || '',
                description: story.description || '',
                scripture: story.scripture || '',
                scriptureText: story.scriptureText || '',
                content: story.content || '',
                ageGroups: story.ageGroups || ['all'],
                goalTags: story.goalTags || [],
                backgroundMusicUrl: story.backgroundMusicUrl || '',
                estimatedDuration: story.estimatedDuration || 3,
                coverPrompt: story.coverPrompt || '',
                defaultCoverUrl: story.defaultCoverUrl || '',
                sceneImageUrl: story.sceneImageUrl || '',
                sceneImagePrompt: story.sceneImagePrompt || '',
                status: story.status || 'draft',
                reflectionQuestions: story.reflectionQuestions || [],
                preferredVoice: story.preferredVoice || '',
            });
        } catch (error) {
            console.error('Error fetching story:', error);
            alert('Failed to load story');
            navigate('/devotional-stories');
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (field: 'ageGroups' | 'goalTags', value: string) => {
        setFormData(prev => {
            const current = prev[field];
            const updated = current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value];
            return { ...prev, [field]: updated };
        });
    };

    const insertChildNamePlaceholder = (field: 'content' | 'displayTitle' | 'coverPrompt') => {
        const textarea = document.querySelector(`[name="${field}"]`) as HTMLTextAreaElement | HTMLInputElement;
        if (textarea) {
            const start = textarea.selectionStart || 0;
            const end = textarea.selectionEnd || 0;
            const currentValue = formData[field];
            const newValue = currentValue.slice(0, start) + '{childName}' + currentValue.slice(end);
            setFormData(prev => ({ ...prev, [field]: newValue }));
            
            // Focus and set cursor position after React re-renders
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + 11, start + 11);
            }, 0);
        }
    };

    const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.includes('audio')) {
            alert('Please select an audio file');
            return;
        }

        setUploadingMusic(true);
        try {
            // If editing, upload directly to the story
            if (id && id !== 'new') {
                const base64 = await fileToBase64(file);
                const response = await apiClient.post(`/api/devotional-stories/${id}/upload-music`, {
                    musicBase64: base64,
                    filename: file.name
                });
                setFormData(prev => ({ ...prev, backgroundMusicUrl: response.data.backgroundMusicUrl }));
            } else {
                // For new stories, we'll need to save first then upload
                alert('Please save the story first, then add background music');
            }
        } catch (error) {
            console.error('Error uploading music:', error);
            alert('Failed to upload music');
        } finally {
            setUploadingMusic(false);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
        });
    };

    const addReflectionQuestion = () => {
        setFormData(prev => ({
            ...prev,
            reflectionQuestions: [
                ...prev.reflectionQuestions,
                { question: '', parentTip: '', emoji: '📖' }
            ]
        }));
    };

    const updateReflectionQuestion = (index: number, field: keyof ReflectionQuestion, value: string) => {
        setFormData(prev => ({
            ...prev,
            reflectionQuestions: prev.reflectionQuestions.map((q, i) =>
                i === index ? { ...q, [field]: value } : q
            )
        }));
    };

    const removeReflectionQuestion = (index: number) => {
        setFormData(prev => ({
            ...prev,
            reflectionQuestions: prev.reflectionQuestions.filter((_, i) => i !== index)
        }));
    };

    const handleGenerateSceneImage = async () => {
        if (!id || id === 'new') {
            alert('Please save the story first, then generate the scene image');
            return;
        }

        setGeneratingScene(true);
        try {
            const response = await apiClient.post(`/api/devotional-stories/${id}/generate-scene`, {
                customPrompt: formData.sceneImagePrompt || undefined
            });
            setFormData(prev => ({ 
                ...prev, 
                sceneImageUrl: response.data.sceneImageUrl 
            }));
        } catch (error) {
            console.error('Error generating scene image:', error);
            alert('Failed to generate scene image');
        } finally {
            setGeneratingScene(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            alert('Please enter a title');
            return;
        }
        if (!formData.displayTitle.trim()) {
            alert('Please enter a display title');
            return;
        }
        if (!formData.scripture.trim()) {
            alert('Please enter a scripture reference');
            return;
        }
        if (!formData.content.trim()) {
            alert('Please enter the story content');
            return;
        }

        setLoading(true);
        try {
            if (id && id !== 'new') {
                await apiClient.put(`/api/devotional-stories/${id}`, formData);
            } else {
                await apiClient.post('/api/devotional-stories', formData);
            }
            navigate('/devotional-stories');
        } catch (error) {
            console.error('Error saving story:', error);
            alert('Failed to save story');
        } finally {
            setLoading(false);
        }
    };

    // Preview: Replace {childName} with sample name
    const getPreviewContent = (text: string) => {
        return text.replace(/\{childName\}/g, 'Emma');
    };

    if (fetching) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/devotional-stories')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold text-gray-800">
                    {id && id !== 'new' ? 'Edit Story' : 'New Devotional Story'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Book className="w-5 h-5 text-indigo-600" />
                        Basic Information
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Template Title (for portal)
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-4 py-2"
                                placeholder="e.g., David's Courage Story"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Display Title (shown to users)
                                <button
                                    type="button"
                                    onClick={() => insertChildNamePlaceholder('displayTitle')}
                                    className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200"
                                >
                                    + {'{childName}'}
                                </button>
                            </label>
                            <input
                                type="text"
                                name="displayTitle"
                                value={formData.displayTitle}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-4 py-2"
                                placeholder="e.g., {childName}'s Big Adventure"
                                required
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description (optional)
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={2}
                                className="w-full border rounded-lg px-4 py-2"
                                placeholder="Brief description for the portal..."
                            />
                        </div>
                    </div>
                </div>

                {/* Scripture */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">Scripture</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Bible Reference
                            </label>
                            <input
                                type="text"
                                name="scripture"
                                value={formData.scripture}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-4 py-2"
                                placeholder="e.g., 1 Samuel 17:45"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Full Scripture Text
                            </label>
                            <input
                                type="text"
                                name="scriptureText"
                                value={formData.scriptureText}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-4 py-2"
                                placeholder="The verse text..."
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Story Content */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                            Story Content
                        </h2>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => insertChildNamePlaceholder('content')}
                                className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200 flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" />
                                Insert {'{childName}'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowPreview(!showPreview)}
                                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                            >
                                <Eye className="w-4 h-4" />
                                {showPreview ? 'Hide Preview' : 'Preview'}
                            </button>
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 mb-3 flex items-center gap-1">
                        <HelpCircle className="w-4 h-4" />
                        Use {'{childName}'} where you want the child's name to appear in the story
                    </p>

                    {showPreview ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-amber-700 font-medium mb-2">Preview (with sample name "Emma"):</p>
                            <div className="whitespace-pre-wrap text-gray-800">
                                {getPreviewContent(formData.content) || 'Enter content to see preview...'}
                            </div>
                        </div>
                    ) : null}

                    <textarea
                        name="content"
                        value={formData.content}
                        onChange={handleChange}
                        rows={12}
                        className="w-full border rounded-lg px-4 py-2 font-mono text-sm"
                        placeholder={`Once upon a time, {childName} learned about a brave young shepherd named David...

{childName} listened carefully as the story continued...

"Just like David, {childName}," the story said, "you can trust God when things seem scary!"`}
                        required
                    />

                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Estimated Duration (minutes)
                            </label>
                            <input
                                type="number"
                                name="estimatedDuration"
                                value={formData.estimatedDuration}
                                onChange={handleChange}
                                min={1}
                                max={15}
                                className="w-full border rounded-lg px-4 py-2"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Preferred Voice (ElevenLabs)
                            </label>
                            <select
                                name="preferredVoice"
                                value={formData.preferredVoice}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-4 py-2"
                            >
                                <option value="">Auto-select (Rachel)</option>
                                {VOICES.map(voice => (
                                    <option key={voice.id} value={voice.id}>
                                        {voice.name} - {voice.description} ({voice.gender})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Targeting */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4">Targeting</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Age Groups
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {AGE_GROUPS.map(age => (
                                    <label
                                        key={age}
                                        className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                                            formData.ageGroups.includes(age)
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.ageGroups.includes(age)}
                                            onChange={() => handleCheckboxChange('ageGroups', age)}
                                            className="sr-only"
                                        />
                                        {age === 'all' ? 'All Ages' : `${age} years`}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Learning Goals
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {GOAL_TAGS.map(tag => (
                                    <label
                                        key={tag}
                                        className={`px-4 py-2 rounded-lg cursor-pointer transition-colors capitalize ${
                                            formData.goalTags.includes(tag)
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.goalTags.includes(tag)}
                                            onChange={() => handleCheckboxChange('goalTags', tag)}
                                            className="sr-only"
                                        />
                                        {tag}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cover & Media */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Music className="w-5 h-5 text-indigo-600" />
                        Media
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cover Generation Prompt
                                <button
                                    type="button"
                                    onClick={() => insertChildNamePlaceholder('coverPrompt')}
                                    className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200"
                                >
                                    + {'{childName}'}
                                </button>
                            </label>
                            <textarea
                                name="coverPrompt"
                                value={formData.coverPrompt}
                                onChange={handleChange}
                                rows={2}
                                className="w-full border rounded-lg px-4 py-2"
                                placeholder="e.g., A brave child standing on a hilltop facing a giant, with sunlight behind them"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                AI will generate a personalized cover image based on this prompt
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Default Cover URL (fallback)
                            </label>
                            <input
                                type="text"
                                name="defaultCoverUrl"
                                value={formData.defaultCoverUrl}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-4 py-2"
                                placeholder="https://..."
                            />
                        </div>

                        {/* Scene Image for Audio Story Player */}
                        <div className="border-t pt-4 mt-4">
                            <h3 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
                                <Image className="w-5 h-5 text-purple-600" />
                                Audio Story Player Scene
                            </h3>
                            <p className="text-sm text-gray-500 mb-3">
                                Generate a background image for the Audio Story Player experience. This image will be displayed while the story is being narrated.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Scene Image Prompt (optional - auto-generates from story if empty)
                                    </label>
                                    <textarea
                                        name="sceneImagePrompt"
                                        value={formData.sceneImagePrompt}
                                        onChange={handleChange}
                                        rows={2}
                                        className="w-full border rounded-lg px-4 py-2"
                                        placeholder="e.g., A peaceful garden with a stone path, flowers blooming, soft morning light filtering through trees"
                                    />
                                </div>

                                {formData.sceneImageUrl ? (
                                    <div className="space-y-3">
                                        <div className="relative rounded-lg overflow-hidden bg-gray-100">
                                            <img
                                                src={formData.sceneImageUrl}
                                                alt="Scene preview"
                                                className="w-full h-48 object-cover"
                                            />
                                            <div className="absolute top-2 right-2">
                                                <button
                                                    type="button"
                                                    onClick={handleGenerateSceneImage}
                                                    disabled={generatingScene || !id || id === 'new'}
                                                    className="p-2 bg-white/90 hover:bg-white rounded-full shadow-lg disabled:opacity-50"
                                                    title="Regenerate scene image"
                                                >
                                                    <RefreshCw className={`w-5 h-5 text-purple-600 ${generatingScene ? 'animate-spin' : ''}`} />
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, sceneImageUrl: '' }))}
                                            className="text-sm text-red-600 hover:text-red-700"
                                        >
                                            Remove scene image
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleGenerateSceneImage}
                                        disabled={generatingScene || !id || id === 'new'}
                                        className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {generatingScene ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                                Generating Scene Image...
                                            </>
                                        ) : (
                                            <>
                                                <Image className="w-5 h-5" />
                                                Generate Scene Image (~$0.02)
                                            </>
                                        )}
                                    </button>
                                )}
                                {(!id || id === 'new') && (
                                    <p className="text-xs text-gray-500">
                                        Save the story first, then generate the scene image
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Background Music
                            </label>
                            {formData.backgroundMusicUrl ? (
                                <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg">
                                    <Music className="w-8 h-8 text-indigo-600" />
                                    <div className="flex-1">
                                        <audio controls src={formData.backgroundMusicUrl} className="w-full" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, backgroundMusicUrl: '' }))}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <input
                                        ref={musicInputRef}
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleMusicUpload}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => musicInputRef.current?.click()}
                                        disabled={uploadingMusic || !id || id === 'new'}
                                        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {uploadingMusic ? (
                                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Upload className="w-5 h-5 text-gray-500" />
                                        )}
                                        {uploadingMusic ? 'Uploading...' : 'Upload Background Music'}
                                    </button>
                                    {(!id || id === 'new') && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Save the story first, then add background music
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Reflection Questions */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">Reflection Questions</h2>
                        <button
                            type="button"
                            onClick={addReflectionQuestion}
                            className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200 flex items-center gap-1"
                        >
                            <Plus className="w-4 h-4" />
                            Add Question
                        </button>
                    </div>

                    {formData.reflectionQuestions.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                            No reflection questions yet. Add questions to help children think about the story.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {formData.reflectionQuestions.map((q, index) => (
                                <div key={index} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-sm font-medium text-gray-500">
                                            Question {index + 1}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeReflectionQuestion(index)}
                                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs text-gray-500 mb-1">Emoji</label>
                                            <select
                                                value={q.emoji}
                                                onChange={(e) => updateReflectionQuestion(index, 'emoji', e.target.value)}
                                                className="w-full border rounded px-2 py-1.5 text-lg"
                                            >
                                                {EMOJIS.map(emoji => (
                                                    <option key={emoji} value={emoji}>{emoji}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="md:col-span-10">
                                            <label className="block text-xs text-gray-500 mb-1">Question</label>
                                            <input
                                                type="text"
                                                value={q.question}
                                                onChange={(e) => updateReflectionQuestion(index, 'question', e.target.value)}
                                                className="w-full border rounded px-3 py-1.5"
                                                placeholder="What did you learn from this story?"
                                            />
                                        </div>

                                        <div className="md:col-span-12">
                                            <label className="block text-xs text-gray-500 mb-1">Parent Tip (optional)</label>
                                            <input
                                                type="text"
                                                value={q.parentTip}
                                                onChange={(e) => updateReflectionQuestion(index, 'parentTip', e.target.value)}
                                                className="w-full border rounded px-3 py-1.5"
                                                placeholder="Tip to help parents guide the discussion..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Status & Actions */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <label className="block text-sm font-medium text-gray-700">
                                Status
                            </label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="border rounded-lg px-4 py-2"
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/devotional-stories')}
                                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-5 h-5" />
                                )}
                                {loading ? 'Saving...' : 'Save Story'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default DevotionalStoryForm;
