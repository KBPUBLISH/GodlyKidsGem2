import React, { useState, useEffect } from 'react';
import { X, BookOpen, Music, Gamepad2, Clock, Coins, TrendingUp, Calendar, Award, Star, Headphones, Check, FileText } from 'lucide-react';
import { useUser, CoinTransaction } from '../../context/UserContext';
import { profileService } from '../../services/profileService';
import { playHistoryService } from '../../services/playHistoryService';
import { activityTrackingService } from '../../services/activityTrackingService';

interface ReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WeeklyStats {
  booksRead: number;
  pagesRead: number;
  songsListened: number;
  gamesPlayed: number;
  lessonsCompleted: number;
  coinsEarned: number;
  timeSpentMinutes: number;
}

interface ActivityEntry {
  type: 'book' | 'song' | 'game' | 'lesson' | 'coins';
  title: string;
  timestamp: number;
  detail?: string;
}

const getActivityIcon = (type: ActivityEntry['type']) => {
  switch (type) {
    case 'book':
      return <BookOpen className="w-4 h-4" />;
    case 'song':
      return <Music className="w-4 h-4" />;
    case 'game':
      return <Gamepad2 className="w-4 h-4" />;
    case 'lesson':
      return <Calendar className="w-4 h-4" />;
    case 'coins':
      return <Coins className="w-4 h-4" />;
    default:
      return <Star className="w-4 h-4" />;
  }
};

const getActivityColor = (type: ActivityEntry['type']) => {
  switch (type) {
    case 'book':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'song':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'game':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'lesson':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'coins':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
};

const ReportCardModal: React.FC<ReportCardModalProps> = ({ isOpen, onClose }) => {
  const { coins, coinTransactions, kids, activeKidId, parentName } = useUser();
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    booksRead: 0,
    pagesRead: 0,
    songsListened: 0,
    gamesPlayed: 0,
    lessonsCompleted: 0,
    coinsEarned: 0,
    timeSpentMinutes: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  
  // Get current profile info
  const activeKid = kids.find(k => k.id === activeKidId);
  const profileName = activeKid?.name || parentName || 'User';
  
  // Load stats when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    const loadStats = () => {
      const periodDays = selectedPeriod === 'week' ? 7 : 30;
      const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
      
      // Get stats from activity tracking service
      const stats = activityTrackingService.getStats(periodDays);
      
      // Coins earned from transactions
      const coinsEarned = coinTransactions
        .filter(t => t.timestamp > cutoff && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      setWeeklyStats({
        booksRead: stats.booksRead,
        pagesRead: stats.pagesRead,
        songsListened: stats.songsListened,
        gamesPlayed: stats.gamesPlayed,
        lessonsCompleted: stats.lessonsCompleted,
        coinsEarned,
        timeSpentMinutes: stats.timeSpentMinutes,
      });
      
      // Build recent activity list
      const activities: ActivityEntry[] = [];
      
      // Add coin transactions as activities
      coinTransactions.slice(0, 20).forEach(t => {
        if (t.amount > 0) {
          activities.push({
            type: 'coins',
            title: t.reason,
            timestamp: t.timestamp,
            detail: `+${t.amount} coins`,
          });
        }
      });
      
      // Add activities from tracking service
      const recentTrackedActivities = activityTrackingService.getRecentActivities(15);
      recentTrackedActivities.forEach(activity => {
        activities.push({
          type: activity.type as any,
          title: activity.title || `${activity.type} activity`,
          timestamp: activity.timestamp,
        });
      });
      
      // Sort by timestamp
      activities.sort((a, b) => b.timestamp - a.timestamp);
      setRecentActivity(activities.slice(0, 20));
    };
    
    loadStats();
  }, [isOpen, selectedPeriod, coinTransactions]);
  
  
  // Hide BottomNavigation when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute('data-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-modal-open');
    }
    
    return () => {
      document.body.removeAttribute('data-modal-open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate grade based on activity
  const totalActivities = weeklyStats.booksRead + weeklyStats.songsListened + weeklyStats.gamesPlayed + weeklyStats.lessonsCompleted;
  const grade = totalActivities >= 20 ? 'A+' : totalActivities >= 15 ? 'A' : totalActivities >= 10 ? 'B' : totalActivities >= 5 ? 'C' : 'D';
  const gradeColor = grade.startsWith('A') ? 'text-green-400' : grade === 'B' ? 'text-blue-400' : grade === 'C' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md max-h-[90vh] bg-gradient-to-b from-[#1a2e1a] to-[#0f1f0f] rounded-3xl border-2 border-[#2E7D32]/50 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-[#2E7D32]/30 bg-gradient-to-r from-[#2E7D32]/20 to-[#388E3C]/20">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
          
          {/* Report Card Title */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 mb-2">
              <Award className="w-6 h-6 text-[#4CAF50]" />
              <h2 className="text-white font-display font-bold text-xl">Report Card</h2>
            </div>
            <p className="text-[#81C784] text-sm font-medium">{profileName}'s Learning Progress</p>
            
            {/* Overall Grade Badge */}
            <div className="mt-4 inline-flex items-center gap-3 bg-black/30 px-5 py-3 rounded-2xl border border-[#4CAF50]/30">
              <div className="text-center">
                <p className="text-white/60 text-xs font-medium mb-1">Overall Grade</p>
                <p className={`${gradeColor} font-black text-4xl font-display`}>{grade}</p>
              </div>
              <div className="h-12 w-px bg-white/10"></div>
              <div className="text-center">
                <p className="text-white/60 text-xs font-medium mb-1">Total Activities</p>
                <p className="text-white font-black text-2xl font-display">{totalActivities}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex justify-center gap-2 py-3 border-b border-[#2E7D32]/30 bg-black/20">
          <button
            onClick={() => setSelectedPeriod('week')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
              selectedPeriod === 'week'
                ? 'bg-[#4CAF50] text-white shadow-lg'
                : 'bg-white/10 text-white/60 hover:text-white'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
              selectedPeriod === 'month'
                ? 'bg-[#4CAF50] text-white shadow-lg'
                : 'bg-white/10 text-white/60 hover:text-white'
            }`}
          >
            This Month
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-[#2E7D32]/30">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'overview'
                ? 'text-[#4CAF50] border-b-2 border-[#4CAF50] bg-[#4CAF50]/10'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Overview
            </span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'activity'
                ? 'text-[#4CAF50] border-b-2 border-[#4CAF50] bg-[#4CAF50]/10'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4" />
              Activity
            </span>
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' ? (
            <div className="p-4 space-y-4">
              {/* Time Spent */}
              <div className="bg-gradient-to-br from-[#4CAF50]/20 to-[#2E7D32]/20 rounded-2xl p-4 border border-[#4CAF50]/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#4CAF50]/30 rounded-xl">
                      <Clock className="w-6 h-6 text-[#81C784]" />
                    </div>
                    <div>
                      <p className="text-white/60 text-xs font-medium">Time Spent</p>
                      <p className="text-white font-bold text-xl">{formatDuration(weeklyStats.timeSpentMinutes)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#81C784] text-xs">Learning Time</p>
                    <p className="text-white/60 text-xs">This {selectedPeriod}</p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Books Read */}
                <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    <span className="text-white/60 text-xs font-medium">Books Read</span>
                  </div>
                  <p className="text-white font-bold text-2xl">{weeklyStats.booksRead}</p>
                  <p className="text-blue-400 text-xs mt-1">📚 Stories explored</p>
                </div>

                {/* Pages Read */}
                <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    <span className="text-white/60 text-xs font-medium">Pages Read</span>
                  </div>
                  <p className="text-white font-bold text-2xl">{weeklyStats.pagesRead}</p>
                  <p className="text-cyan-400 text-xs mt-1">📄 Pages turned</p>
                </div>

                {/* Songs Listened */}
                <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="w-5 h-5 text-purple-400" />
                    <span className="text-white/60 text-xs font-medium">Songs Played</span>
                  </div>
                  <p className="text-white font-bold text-2xl">{weeklyStats.songsListened}</p>
                  <p className="text-purple-400 text-xs mt-1">🎵 Worship songs</p>
                </div>

                {/* Games Played */}
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Gamepad2 className="w-5 h-5 text-green-400" />
                    <span className="text-white/60 text-xs font-medium">Games Played</span>
                  </div>
                  <p className="text-white font-bold text-2xl">{weeklyStats.gamesPlayed}</p>
                  <p className="text-green-400 text-xs mt-1">🎮 Brain challenges</p>
                </div>

                {/* Lessons Completed */}
                <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/30 col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-orange-400" />
                    <span className="text-white/60 text-xs font-medium">Lessons Completed</span>
                  </div>
                  <p className="text-white font-bold text-2xl">{weeklyStats.lessonsCompleted}</p>
                  <p className="text-orange-400 text-xs mt-1">📖 Daily video lessons</p>
                </div>
              </div>

              {/* Coins Earned */}
              <div className="bg-gradient-to-br from-[#FFD700]/10 to-[#B8860B]/10 rounded-2xl p-4 border border-[#FFD700]/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#FFD700]/30 rounded-xl">
                      <Coins className="w-6 h-6 text-[#FFD700]" />
                    </div>
                    <div>
                      <p className="text-white/60 text-xs font-medium">Coins Earned</p>
                      <p className="text-[#FFD700] font-bold text-xl">+{weeklyStats.coinsEarned}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 text-xs">Current Balance</p>
                    <p className="text-[#FFD700] font-bold">{coins.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Encouragement Message */}
              <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
                {totalActivities >= 15 ? (
                  <>
                    <p className="text-white font-bold text-lg mb-1">🌟 Amazing Job!</p>
                    <p className="text-white/70 text-sm">You're a super learner! Keep up the great work!</p>
                  </>
                ) : totalActivities >= 10 ? (
                  <>
                    <p className="text-white font-bold text-lg mb-1">👏 Great Progress!</p>
                    <p className="text-white/70 text-sm">You're doing well! A few more activities to level up!</p>
                  </>
                ) : totalActivities >= 5 ? (
                  <>
                    <p className="text-white font-bold text-lg mb-1">📚 Keep Going!</p>
                    <p className="text-white/70 text-sm">Good start! Try reading more books and playing games!</p>
                  </>
                ) : (
                  <>
                    <p className="text-white font-bold text-lg mb-1">🚀 Let's Get Started!</p>
                    <p className="text-white/70 text-sm">Read a book or play a game to earn your first stars!</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Activity Tab */
            <div className="p-4">
              {recentActivity.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-black/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-10 h-10 text-white/20" />
                  </div>
                  <p className="text-white/50 text-sm font-medium">No recent activity</p>
                  <p className="text-white/30 text-xs mt-2 max-w-[200px] mx-auto">
                    Start reading books, playing games, or listening to songs!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map((activity, index) => (
                    <div
                      key={`${activity.type}-${activity.timestamp}-${index}`}
                      className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                    >
                      {/* Activity Icon */}
                      <div className={`p-2 rounded-xl border ${getActivityColor(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {activity.title}
                        </p>
                        <p className="text-white/40 text-xs">
                          {formatTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                      
                      {/* Detail Badge */}
                      {activity.detail && (
                        <span className="text-[#4CAF50] text-xs font-bold bg-[#4CAF50]/20 px-2 py-1 rounded-full">
                          {activity.detail}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-4 border-t border-[#2E7D32]/30 bg-black/20 text-center">
          <p className="text-white/40 text-xs">
            📊 Report cards update in real-time as {profileName} learns!
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportCardModal;
