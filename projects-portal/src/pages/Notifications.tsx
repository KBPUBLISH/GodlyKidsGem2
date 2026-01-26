import React, { useState, useEffect } from 'react';
import { Bell, Send, Clock, Users, Image, Link, AlertCircle, CheckCircle, Settings, Calendar, Sun, Moon, Sparkles, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import apiClient from '../services/apiClient';

interface NotificationForm {
    title: string;
    message: string;
    url: string;
    imageUrl: string;
    segment: string;
    scheduledTime: string;
}

interface AutoNotificationSettings {
    dailyReminder: {
        enabled: boolean;
        time: string;
        title: string;
        message: string;
    };
    morningDevotional: {
        enabled: boolean;
        time: string;
        title: string;
        message: string;
    };
    eveningStory: {
        enabled: boolean;
        time: string;
        title: string;
        message: string;
    };
    weeklyDigest: {
        enabled: boolean;
        dayOfWeek: number;
        time: string;
        title: string;
        message: string;
    };
    inactivityReminder: {
        enabled: boolean;
        daysInactive: number;
        title: string;
        message: string;
    };
}

const Notifications: React.FC = () => {
    const [form, setForm] = useState<NotificationForm>({
        title: '',
        message: '',
        url: '',
        imageUrl: '',
        segment: 'All',
        scheduledTime: ''
    });
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'manual' | 'automatic'>('manual');
    const [savingAuto, setSavingAuto] = useState(false);
    const [autoResult, setAutoResult] = useState<{ success: boolean; message: string } | null>(null);
    
    const [autoSettings, setAutoSettings] = useState<AutoNotificationSettings>({
        dailyReminder: {
            enabled: false,
            time: '09:00',
            title: '🌟 Time to Learn!',
            message: "Your daily adventure awaits! Open the app to continue your faith journey."
        },
        morningDevotional: {
            enabled: false,
            time: '07:00',
            title: '☀️ Good Morning!',
            message: "Start your day with today's devotional lesson. A new story is waiting!"
        },
        eveningStory: {
            enabled: false,
            time: '19:00',
            title: '🌙 Bedtime Story',
            message: "Wind down with a calming Bible story before bed. Sweet dreams!"
        },
        weeklyDigest: {
            enabled: false,
            dayOfWeek: 0, // Sunday
            time: '10:00',
            title: '📊 Weekly Progress',
            message: "See how much you've learned this week! Check out your achievements."
        },
        inactivityReminder: {
            enabled: false,
            daysInactive: 3,
            title: '👋 We Miss You!',
            message: "It's been a while! Your friends in Godly Kids are waiting for you."
        }
    });

    // Load auto settings on mount
    useEffect(() => {
        const loadAutoSettings = async () => {
            try {
                const response = await apiClient.get('/api/notifications/auto-settings');
                if (response.data.settings) {
                    setAutoSettings(response.data.settings);
                }
            } catch (error) {
                console.log('No existing auto settings found');
            }
        };
        loadAutoSettings();
    }, []);

    const saveAutoSettings = async () => {
        setSavingAuto(true);
        setAutoResult(null);
        try {
            await apiClient.post('/api/notifications/auto-settings', { settings: autoSettings });
            setAutoResult({ success: true, message: 'Automatic notification settings saved successfully!' });
        } catch (error: any) {
            setAutoResult({ 
                success: false, 
                message: error.response?.data?.message || 'Failed to save settings' 
            });
        } finally {
            setSavingAuto(false);
        }
    };

    const daysOfWeek = [
        { value: 0, label: 'Sunday' },
        { value: 1, label: 'Monday' },
        { value: 2, label: 'Tuesday' },
        { value: 3, label: 'Wednesday' },
        { value: 4, label: 'Thursday' },
        { value: 5, label: 'Friday' },
        { value: 6, label: 'Saturday' }
    ];

    const segments = [
        { id: 'All', name: 'All Users', description: 'Send to all subscribed users' },
        { id: 'Active Users', name: 'Active Users', description: 'Users active in the last 7 days' },
        { id: 'Inactive Users', name: 'Inactive Users', description: 'Users inactive for 7+ days' },
        { id: 'Engaged Users', name: 'Engaged Users', description: 'Highly engaged users' }
    ];

    const handleSubmit = async (e: React.FormEvent, scheduled: boolean = false) => {
        e.preventDefault();
        
        if (!form.title.trim() || !form.message.trim()) {
            setResult({ success: false, message: 'Title and message are required' });
            return;
        }

        setSending(true);
        setResult(null);

        try {
            const endpoint = scheduled ? '/api/notifications/schedule' : '/api/notifications/send';
            const payload: any = {
                title: form.title,
                message: form.message,
                segments: [form.segment]
            };

            if (form.url) payload.url = form.url;
            if (form.imageUrl) payload.imageUrl = form.imageUrl;
            if (scheduled && form.scheduledTime) {
                payload.sendAt = new Date(form.scheduledTime).toISOString();
            }

            const response = await apiClient.post(endpoint, payload);

            if (response.data.success) {
                setResult({ 
                    success: true, 
                    message: scheduled 
                        ? `Notification scheduled for ${new Date(form.scheduledTime).toLocaleString()}`
                        : `Notification sent to ${response.data.recipients || 'all'} users!`
                });
                // Reset form
                setForm({
                    title: '',
                    message: '',
                    url: '',
                    imageUrl: '',
                    segment: 'All',
                    scheduledTime: ''
                });
            } else {
                setResult({ success: false, message: 'Failed to send notification' });
            }
        } catch (error: any) {
            console.error('Notification error:', error);
            setResult({ 
                success: false, 
                message: error.response?.data?.message || 'Failed to send notification' 
            });
        } finally {
            setSending(false);
        }
    };

    const quickTemplates = [
        { 
            title: '📚 New Story Available!', 
            message: 'Check out our latest adventure waiting for you!',
            icon: '📚'
        },
        { 
            title: '🎵 New Audio Content', 
            message: 'New songs and stories are ready to listen!',
            icon: '🎵'
        },
        { 
            title: '⭐ Daily Lesson Ready', 
            message: "Today's lesson is waiting for you. Let's learn together!",
            icon: '⭐'
        },
        { 
            title: '🎁 Special Reward!', 
            message: 'You have earned a special reward. Come claim it!',
            icon: '🎁'
        }
    ];

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 rounded-xl">
                        <Bell className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Push Notifications</h1>
                        <p className="text-gray-500">Send notifications to your app users</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        activeTab === 'manual'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <Send className="w-4 h-4" />
                    Manual Notifications
                </button>
                <button
                    onClick={() => setActiveTab('automatic')}
                    className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        activeTab === 'automatic'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <Settings className="w-4 h-4" />
                    Automatic Notifications
                </button>
            </div>

            {/* Result Message */}
            {result && activeTab === 'manual' && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                    result.success 
                        ? 'bg-green-50 border border-green-200 text-green-800' 
                        : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                    {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    {result.message}
                </div>
            )}

            {autoResult && activeTab === 'automatic' && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                    autoResult.success 
                        ? 'bg-green-50 border border-green-200 text-green-800' 
                        : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                    {autoResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    {autoResult.message}
                </div>
            )}

            {/* Manual Notifications Tab */}
            {activeTab === 'manual' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Send className="w-5 h-5 text-indigo-600" />
                            Compose Notification
                        </h2>

                        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="Notification title..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    maxLength={50}
                                />
                                <p className="text-xs text-gray-400 mt-1">{form.title.length}/50 characters</p>
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Message *
                                </label>
                                <textarea
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                                    placeholder="Notification message..."
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                    maxLength={200}
                                />
                                <p className="text-xs text-gray-400 mt-1">{form.message.length}/200 characters</p>
                            </div>

                            {/* Target Segment */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Users className="w-4 h-4 inline mr-1" />
                                    Target Audience
                                </label>
                                <select
                                    value={form.segment}
                                    onChange={(e) => setForm({ ...form, segment: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    {segments.map((seg) => (
                                        <option key={seg.id} value={seg.id}>
                                            {seg.name} - {seg.description}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Optional URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Link className="w-4 h-4 inline mr-1" />
                                    Link URL (optional)
                                </label>
                                <input
                                    type="url"
                                    value={form.url}
                                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            {/* Optional Image */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Image className="w-4 h-4 inline mr-1" />
                                    Image URL (optional)
                                </label>
                                <input
                                    type="url"
                                    value={form.imageUrl}
                                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            {/* Schedule Time */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Clock className="w-4 h-4 inline mr-1" />
                                    Schedule (optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={form.scheduledTime}
                                    onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={sending || !form.title || !form.message}
                                    className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {sending ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Send Now
                                        </>
                                    )}
                                </button>

                                {form.scheduledTime && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleSubmit(e, true)}
                                        disabled={sending || !form.title || !form.message}
                                        className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Clock className="w-5 h-5" />
                                        Schedule
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Quick Templates Sidebar */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Templates</h2>
                        <div className="space-y-3">
                            {quickTemplates.map((template, index) => (
                                <button
                                    key={index}
                                    onClick={() => setForm({
                                        ...form,
                                        title: template.title,
                                        message: template.message
                                    })}
                                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">{template.icon}</span>
                                        <div>
                                            <p className="font-medium text-gray-800 text-sm">{template.title}</p>
                                            <p className="text-xs text-gray-500 mt-1">{template.message}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview Card */}
                    {(form.title || form.message) && (
                        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">Preview</h2>
                            <div className="bg-gray-100 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-lg">✨</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900 text-sm truncate">
                                            {form.title || 'Notification Title'}
                                        </p>
                                        <p className="text-gray-600 text-xs mt-1 line-clamp-2">
                                            {form.message || 'Notification message will appear here...'}
                                        </p>
                                        <p className="text-gray-400 text-xs mt-2">Godly Kids • now</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Automatic Notifications Tab */}
            {activeTab === 'automatic' && (
                <div className="space-y-6">
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-lg shadow-sm">
                                <Clock className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800">Automatic Notifications (Local User Time)</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Configure notifications that are sent automatically based on each user's local timezone. 
                                    These notifications help keep users engaged with consistent reminders.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Daily Reminder */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <Sparkles className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Daily Reminder</h3>
                                        <p className="text-xs text-gray-500">Encourage daily app usage</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAutoSettings({
                                        ...autoSettings,
                                        dailyReminder: { ...autoSettings.dailyReminder, enabled: !autoSettings.dailyReminder.enabled }
                                    })}
                                    className="text-2xl"
                                >
                                    {autoSettings.dailyReminder.enabled ? (
                                        <ToggleRight className="w-10 h-10 text-indigo-600" />
                                    ) : (
                                        <ToggleLeft className="w-10 h-10 text-gray-300" />
                                    )}
                                </button>
                            </div>
                            <div className={`space-y-3 ${!autoSettings.dailyReminder.enabled && 'opacity-50 pointer-events-none'}`}>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Time (User's Local)</label>
                                    <input
                                        type="time"
                                        value={autoSettings.dailyReminder.time}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            dailyReminder: { ...autoSettings.dailyReminder, time: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={autoSettings.dailyReminder.title}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            dailyReminder: { ...autoSettings.dailyReminder, title: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                    <textarea
                                        value={autoSettings.dailyReminder.message}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            dailyReminder: { ...autoSettings.dailyReminder, message: e.target.value }
                                        })}
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Morning Devotional */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-100 rounded-lg">
                                        <Sun className="w-5 h-5 text-orange-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Morning Devotional</h3>
                                        <p className="text-xs text-gray-500">Start the day with faith</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAutoSettings({
                                        ...autoSettings,
                                        morningDevotional: { ...autoSettings.morningDevotional, enabled: !autoSettings.morningDevotional.enabled }
                                    })}
                                    className="text-2xl"
                                >
                                    {autoSettings.morningDevotional.enabled ? (
                                        <ToggleRight className="w-10 h-10 text-indigo-600" />
                                    ) : (
                                        <ToggleLeft className="w-10 h-10 text-gray-300" />
                                    )}
                                </button>
                            </div>
                            <div className={`space-y-3 ${!autoSettings.morningDevotional.enabled && 'opacity-50 pointer-events-none'}`}>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Time (User's Local)</label>
                                    <input
                                        type="time"
                                        value={autoSettings.morningDevotional.time}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            morningDevotional: { ...autoSettings.morningDevotional, time: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={autoSettings.morningDevotional.title}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            morningDevotional: { ...autoSettings.morningDevotional, title: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                    <textarea
                                        value={autoSettings.morningDevotional.message}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            morningDevotional: { ...autoSettings.morningDevotional, message: e.target.value }
                                        })}
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Evening Story */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 rounded-lg">
                                        <Moon className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Evening Story Time</h3>
                                        <p className="text-xs text-gray-500">Bedtime stories reminder</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAutoSettings({
                                        ...autoSettings,
                                        eveningStory: { ...autoSettings.eveningStory, enabled: !autoSettings.eveningStory.enabled }
                                    })}
                                    className="text-2xl"
                                >
                                    {autoSettings.eveningStory.enabled ? (
                                        <ToggleRight className="w-10 h-10 text-indigo-600" />
                                    ) : (
                                        <ToggleLeft className="w-10 h-10 text-gray-300" />
                                    )}
                                </button>
                            </div>
                            <div className={`space-y-3 ${!autoSettings.eveningStory.enabled && 'opacity-50 pointer-events-none'}`}>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Time (User's Local)</label>
                                    <input
                                        type="time"
                                        value={autoSettings.eveningStory.time}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            eveningStory: { ...autoSettings.eveningStory, time: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={autoSettings.eveningStory.title}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            eveningStory: { ...autoSettings.eveningStory, title: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                    <textarea
                                        value={autoSettings.eveningStory.message}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            eveningStory: { ...autoSettings.eveningStory, message: e.target.value }
                                        })}
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Weekly Digest */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <Calendar className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Weekly Progress Digest</h3>
                                        <p className="text-xs text-gray-500">Weekly achievement summary</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAutoSettings({
                                        ...autoSettings,
                                        weeklyDigest: { ...autoSettings.weeklyDigest, enabled: !autoSettings.weeklyDigest.enabled }
                                    })}
                                    className="text-2xl"
                                >
                                    {autoSettings.weeklyDigest.enabled ? (
                                        <ToggleRight className="w-10 h-10 text-indigo-600" />
                                    ) : (
                                        <ToggleLeft className="w-10 h-10 text-gray-300" />
                                    )}
                                </button>
                            </div>
                            <div className={`space-y-3 ${!autoSettings.weeklyDigest.enabled && 'opacity-50 pointer-events-none'}`}>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                                        <select
                                            value={autoSettings.weeklyDigest.dayOfWeek}
                                            onChange={(e) => setAutoSettings({
                                                ...autoSettings,
                                                weeklyDigest: { ...autoSettings.weeklyDigest, dayOfWeek: parseInt(e.target.value) }
                                            })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        >
                                            {daysOfWeek.map(day => (
                                                <option key={day.value} value={day.value}>{day.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                                        <input
                                            type="time"
                                            value={autoSettings.weeklyDigest.time}
                                            onChange={(e) => setAutoSettings({
                                                ...autoSettings,
                                                weeklyDigest: { ...autoSettings.weeklyDigest, time: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={autoSettings.weeklyDigest.title}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            weeklyDigest: { ...autoSettings.weeklyDigest, title: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                    <textarea
                                        value={autoSettings.weeklyDigest.message}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            weeklyDigest: { ...autoSettings.weeklyDigest, message: e.target.value }
                                        })}
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Inactivity Reminder */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-100 rounded-lg">
                                        <Bell className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Inactivity Reminder</h3>
                                        <p className="text-xs text-gray-500">Re-engage inactive users</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAutoSettings({
                                        ...autoSettings,
                                        inactivityReminder: { ...autoSettings.inactivityReminder, enabled: !autoSettings.inactivityReminder.enabled }
                                    })}
                                    className="text-2xl"
                                >
                                    {autoSettings.inactivityReminder.enabled ? (
                                        <ToggleRight className="w-10 h-10 text-indigo-600" />
                                    ) : (
                                        <ToggleLeft className="w-10 h-10 text-gray-300" />
                                    )}
                                </button>
                            </div>
                            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${!autoSettings.inactivityReminder.enabled && 'opacity-50 pointer-events-none'}`}>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Days Inactive</label>
                                    <select
                                        value={autoSettings.inactivityReminder.daysInactive}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            inactivityReminder: { ...autoSettings.inactivityReminder, daysInactive: parseInt(e.target.value) }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value={1}>1 day</option>
                                        <option value={2}>2 days</option>
                                        <option value={3}>3 days</option>
                                        <option value={5}>5 days</option>
                                        <option value={7}>7 days</option>
                                        <option value={14}>14 days</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={autoSettings.inactivityReminder.title}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            inactivityReminder: { ...autoSettings.inactivityReminder, title: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                    <input
                                        type="text"
                                        value={autoSettings.inactivityReminder.message}
                                        onChange={(e) => setAutoSettings({
                                            ...autoSettings,
                                            inactivityReminder: { ...autoSettings.inactivityReminder, message: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={saveAutoSettings}
                            disabled={savingAuto}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {savingAuto ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Save Auto Notification Settings
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;



