import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Smartphone } from 'lucide-react';
import RadioPreview from '../components/RadioPreview';

const RadioPreviewPage: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        to="/radio"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Radio Preview</h1>
                        <p className="text-gray-500">Preview how your radio station will sound</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Preview Player */}
                <div>
                    <RadioPreview />
                </div>

                {/* App Preview Mockup */}
                <div className="flex justify-center">
                    <div className="relative">
                        {/* Phone Frame */}
                        <div className="w-[320px] bg-gray-900 rounded-[40px] p-3 shadow-2xl">
                            {/* Phone Notch */}
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10"></div>
                            
                            {/* Phone Screen */}
                            <div className="bg-white rounded-[32px] overflow-hidden h-[640px]">
                                {/* Status Bar */}
                                <div className="bg-gradient-to-br from-indigo-900 to-purple-900 px-6 pt-10 pb-4">
                                    <div className="flex items-center justify-between text-white text-xs">
                                        <span>9:41</span>
                                        <div className="flex items-center gap-1">
                                            <span>●●●●</span>
                                            <span>📶</span>
                                            <span>🔋</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* App Content Preview */}
                                <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 h-full p-4">
                                    {/* Mini Player UI */}
                                    <div className="flex flex-col items-center text-white pt-8">
                                        {/* Station Logo */}
                                        <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                                            <span className="text-2xl">📻</span>
                                        </div>
                                        
                                        <h2 className="text-lg font-bold">Praise Station Radio</h2>
                                        <p className="text-xs text-indigo-200 mb-8">Uplifting music for the whole family</p>
                                        
                                        {/* Album Art Placeholder */}
                                        <div className="w-48 h-48 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-xl mb-6 flex items-center justify-center">
                                            <span className="text-6xl">🎵</span>
                                        </div>
                                        
                                        {/* Track Info */}
                                        <div className="text-center mb-6">
                                            <p className="text-xs text-indigo-300 mb-1">NOW PLAYING</p>
                                            <h3 className="text-xl font-bold">Amazing Grace</h3>
                                            <p className="text-sm text-indigo-200">Chris Tomlin</p>
                                        </div>
                                        
                                        {/* Progress Bar */}
                                        <div className="w-full px-4 mb-6">
                                            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                                                <div className="h-full w-1/3 bg-white rounded-full"></div>
                                            </div>
                                            <div className="flex justify-between text-xs text-indigo-200 mt-1">
                                                <span>1:24</span>
                                                <span>4:32</span>
                                            </div>
                                        </div>
                                        
                                        {/* Controls */}
                                        <div className="flex items-center gap-8">
                                            <button className="text-white/70">⏮</button>
                                            <button className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-indigo-900">
                                                <span className="text-2xl">▶</span>
                                            </button>
                                            <button className="text-white/70">⏭</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Label */}
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-gray-500 text-sm">
                            <Smartphone className="w-4 h-4" />
                            <span>App Preview</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-bold text-blue-800 mb-2">How the Radio Works</h3>
                <ul className="text-sm text-blue-700 space-y-2">
                    <li>• <strong>Continuous playback:</strong> Songs play automatically one after another</li>
                    <li>• <strong>Host breaks:</strong> AI hosts introduce songs with uplifting commentary every few tracks</li>
                    <li>• <strong>30-second segments:</strong> Host breaks are kept brief to maintain listening flow</li>
                    <li>• <strong>Family-friendly:</strong> All content is suitable for children and families</li>
                </ul>
            </div>
        </div>
    );
};

export default RadioPreviewPage;



