import React, { useState } from 'react';
import { Play, BookOpen, Brain } from 'lucide-react';
import VideoLessonModal from '../components/features/VideoLessonModal';

// Sample lesson data
const sampleQuizLesson = {
    _id: 'demo-quiz-lesson',
    title: 'Walking in Faith',
    description: 'Learn about trusting God in difficult times',
    thumbnailUrl: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=800',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    videoDuration: 596,
    captions: [
        { timestamp: 0, text: 'Welcome to today\'s lesson on faith!' },
        { timestamp: 5, text: 'Faith is trusting God even when we can\'t see the path ahead.' },
        { timestamp: 12, text: 'The Bible tells us many stories of people who walked by faith.' },
        { timestamp: 20, text: 'Abraham left his home without knowing where he was going.' },
        { timestamp: 28, text: 'Moses led the Israelites through the Red Sea.' },
        { timestamp: 35, text: 'David faced Goliath with just a sling and stones.' },
        { timestamp: 42, text: 'Each of them trusted God completely.' },
        { timestamp: 50, text: 'Today, we can have that same faith in our lives.' }
    ],
    devotionalText: `"Now faith is confidence in what we hope for and assurance about what we do not see." - Hebrews 11:1

Faith is like walking on a path in the dark with a flashlight. You can only see a few steps ahead, but you trust that the path continues beyond what you can see.

God calls us to trust Him even when we don't understand everything. Just like Abraham, Moses, and David, we can take steps of faith knowing that God is with us.

When you face challenges today, remember that God is faithful. He has never failed anyone who put their trust in Him. Your faith doesn't have to be perfect - even faith as small as a mustard seed can move mountains!

Take a moment to think about one area of your life where you need to trust God more. What would it look like to take a step of faith in that area today?`,
    activityType: 'quiz' as const,
    activityData: {
        questions: [
            {
                question: 'According to Hebrews 11:1, what is faith?',
                options: [
                    'Confidence in what we hope for',
                    'Being afraid of the future',
                    'Only believing what we can see',
                    'Trusting in ourselves'
                ],
                correctAnswer: 0,
                aiGenerated: false
            },
            {
                question: 'Who faced Goliath with faith in God?',
                options: [
                    'Moses',
                    'Abraham',
                    'David',
                    'Joshua'
                ],
                correctAnswer: 2,
                aiGenerated: false
            },
            {
                question: 'What did Jesus say about the size of faith needed?',
                options: [
                    'You need perfect faith',
                    'Faith as small as a mustard seed can move mountains',
                    'Only adults can have real faith',
                    'Faith doesn\'t really matter'
                ],
                correctAnswer: 1,
                aiGenerated: false
            },
            {
                question: 'When we walk by faith, we are:',
                options: [
                    'Trusting God even when we can\'t see everything',
                    'Never facing any problems',
                    'Always understanding God\'s plan completely',
                    'Walking alone without help'
                ],
                correctAnswer: 0,
                aiGenerated: false
            },
            {
                question: 'What should we remember when facing challenges?',
                options: [
                    'We should give up',
                    'God is faithful and has never failed those who trust Him',
                    'We must solve everything ourselves',
                    'Challenges mean God has abandoned us'
                ],
                correctAnswer: 1,
                aiGenerated: false
            }
        ]
    },
    scheduledDate: new Date().toISOString(),
    coinReward: 50
};

const sampleReflectionLesson = {
    _id: 'demo-reflection-lesson',
    title: 'Gratitude & Thankfulness',
    description: 'Discovering the power of a grateful heart',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    videoDuration: 653,
    captions: [
        { timestamp: 0, text: 'Today we\'re learning about gratitude and thankfulness.' },
        { timestamp: 6, text: 'Being thankful changes how we see the world.' },
        { timestamp: 13, text: 'The Bible tells us to give thanks in all circumstances.' },
        { timestamp: 21, text: 'Even when things are hard, we can find things to be grateful for.' },
        { timestamp: 30, text: 'Gratitude helps us focus on God\'s blessings instead of our problems.' }
    ],
    devotionalText: `"Give thanks in all circumstances; for this is God's will for you in Christ Jesus." - 1 Thessalonians 5:18

Gratitude is like a superpower that can transform your day! When we choose to be thankful, we start to notice all the good things God has given us.

Think about it: you woke up this morning, you have food to eat, people who love you, and a God who cares about every detail of your life. These are all gifts worth celebrating!

The Apostle Paul wrote about giving thanks "in all circumstances" - not just when things are going well. Even in difficult times, we can thank God for His presence, His love, and His promises.

When you practice gratitude, something amazing happens. Your heart becomes lighter, your perspective shifts, and you start to see God's hand in everything around you.

Today, let's take time to count our blessings and thank God for His goodness!`,
    activityType: 'reflection' as const,
    activityData: {
        prompts: [
            {
                prompt: 'How grateful do you feel for the blessings in your life today?',
                type: 'scale' as const,
                aiGenerated: false
            },
            {
                prompt: 'How often do you take time to thank God for what He has given you?',
                type: 'scale' as const,
                aiGenerated: false
            },
            {
                prompt: 'When facing challenges, how easy is it for you to find things to be thankful for?',
                type: 'scale' as const,
                aiGenerated: false
            },
            {
                prompt: 'Write down three things you are grateful for today:',
                type: 'text' as const,
                aiGenerated: false
            },
            {
                prompt: 'How can you practice gratitude more in your daily life?',
                type: 'text' as const,
                aiGenerated: false
            }
        ]
    },
    scheduledDate: new Date().toISOString(),
    coinReward: 50
};

const VideoLessonDemo: React.FC = () => {
    const [showModal, setShowModal] = useState(false);
    const [selectedLesson, setSelectedLesson] = useState<typeof sampleQuizLesson | typeof sampleReflectionLesson | null>(null);
    const [totalCoins, setTotalCoins] = useState(0);

    const handleLessonClick = (lesson: typeof sampleQuizLesson | typeof sampleReflectionLesson) => {
        setSelectedLesson(lesson);
        setShowModal(true);
    };

    const handleComplete = (coins: number) => {
        setTotalCoins(prev => prev + coins);
        console.log(`Lesson completed! Earned ${coins} coins. Total: ${totalCoins + coins}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-12">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-bold text-white mb-4">
                        Daily Video Lesson Demo
                    </h1>
                    <p className="text-[#94a3b8] text-lg">
                        Click on a lesson card to experience the full flow
                    </p>
                </div>

                {/* Coin Display */}
                <div className="bg-gradient-to-r from-[#FFD700]/20 to-[#FFA500]/20 border-2 border-[#FFD700] rounded-2xl p-6 max-w-md mx-auto">
                    <div className="flex items-center justify-center gap-4">
                        <div className="w-12 h-12 bg-[#FFD700] rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-2xl">🪙</span>
                        </div>
                        <div>
                            <p className="text-white/60 text-sm">Total Coins Earned</p>
                            <p className="text-[#FFD700] text-3xl font-bold">{totalCoins}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lesson Cards */}
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
                {/* Quiz Lesson Card */}
                <div
                    onClick={() => handleLessonClick(sampleQuizLesson)}
                    className="group cursor-pointer"
                >
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden border border-white/20 hover:border-[#FFD700] transition-all hover:scale-105 hover:shadow-2xl">
                        {/* Thumbnail */}
                        <div className="relative h-48 overflow-hidden">
                            <img
                                src={sampleQuizLesson.thumbnailUrl}
                                alt={sampleQuizLesson.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                                    <Play className="text-[#8B4513] ml-1" size={32} />
                                </div>
                            </div>

                            {/* NEW Badge */}
                            <div className="absolute top-4 right-4 bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                                NEW
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <BookOpen className="text-[#FFD700]" size={20} />
                                <span className="text-[#FFD700] text-sm font-bold uppercase tracking-wider">
                                    Quiz Lesson
                                </span>
                            </div>
                            <h3 className="text-white text-2xl font-bold mb-2">
                                {sampleQuizLesson.title}
                            </h3>
                            <p className="text-[#94a3b8] mb-4">
                                {sampleQuizLesson.description}
                            </p>

                            {/* Progress Bar */}
                            <div className="mb-4">
                                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] w-0" />
                                </div>
                                <p className="text-white/40 text-xs mt-1">Not started</p>
                            </div>

                            {/* Reward */}
                            <div className="flex items-center gap-2 text-[#FFD700]">
                                <div className="w-6 h-6 bg-[#FFD700] rounded-full flex items-center justify-center">
                                    <span className="text-sm">🪙</span>
                                </div>
                                <span className="font-bold">+{sampleQuizLesson.coinReward} coins</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Reflection Lesson Card */}
                <div
                    onClick={() => handleLessonClick(sampleReflectionLesson)}
                    className="group cursor-pointer"
                >
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden border border-white/20 hover:border-[#FFD700] transition-all hover:scale-105 hover:shadow-2xl">
                        {/* Thumbnail */}
                        <div className="relative h-48 overflow-hidden">
                            <img
                                src={sampleReflectionLesson.thumbnailUrl}
                                alt={sampleReflectionLesson.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                                    <Play className="text-[#8B4513] ml-1" size={32} />
                                </div>
                            </div>

                            {/* NEW Badge */}
                            <div className="absolute top-4 right-4 bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                                NEW
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Brain className="text-[#FFD700]" size={20} />
                                <span className="text-[#FFD700] text-sm font-bold uppercase tracking-wider">
                                    Reflection Lesson
                                </span>
                            </div>
                            <h3 className="text-white text-2xl font-bold mb-2">
                                {sampleReflectionLesson.title}
                            </h3>
                            <p className="text-[#94a3b8] mb-4">
                                {sampleReflectionLesson.description}
                            </p>

                            {/* Progress Bar */}
                            <div className="mb-4">
                                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] w-0" />
                                </div>
                                <p className="text-white/40 text-xs mt-1">Not started</p>
                            </div>

                            {/* Reward */}
                            <div className="flex items-center gap-2 text-[#FFD700]">
                                <div className="w-6 h-6 bg-[#FFD700] rounded-full flex items-center justify-center">
                                    <span className="text-sm">🪙</span>
                                </div>
                                <span className="font-bold">+{sampleReflectionLesson.coinReward} coins</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="max-w-4xl mx-auto mt-12 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
                <h3 className="text-white font-bold text-lg mb-3">📝 Demo Instructions</h3>
                <ul className="text-[#94a3b8] space-y-2 text-sm">
                    <li>• <strong className="text-white">Quiz Lesson:</strong> Experience the video → devotional → quiz flow with 5 questions</li>
                    <li>• <strong className="text-white">Reflection Lesson:</strong> Experience the video → devotional → self-reflection flow</li>
                    <li>• Watch the progress bar at the top track your journey through each screen</li>
                    <li>• Complete either lesson to earn 50 gold coins!</li>
                    <li>• The videos are sample videos from Google (Big Buck Bunny & Elephant's Dream)</li>
                </ul>
            </div>

            {/* Modal */}
            <VideoLessonModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                lesson={selectedLesson}
                onComplete={handleComplete}
            />
        </div>
    );
};

export default VideoLessonDemo;
