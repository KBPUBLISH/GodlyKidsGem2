import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Sparkles, RefreshCw } from 'lucide-react';
import { useUser } from '../../context/UserContext';

interface PoseData {
  url: string;
  name: string;
  description: string;
}

interface CharacterPoseGeneratorProps {
  kidId: string;
  kidName: string;
  selfieBase64: string;
  styleId: string;
  onComplete: (poses: { [poseId: string]: PoseData }) => void;
  onError?: (error: string) => void;
}

const POSE_ORDER = [
  'standing_front',
  'standing_happy', 
  'sitting',
  'reading',
  'praying',
  'walking',
  'thinking',
  'pointing',
  'waving',
  'celebrating'
];

const POSE_EMOJIS: { [key: string]: string } = {
  standing_front: '🧍',
  standing_happy: '😄',
  sitting: '🪑',
  reading: '📖',
  praying: '🙏',
  walking: '🚶',
  thinking: '🤔',
  pointing: '👉',
  waving: '👋',
  celebrating: '🎉'
};

const CharacterPoseGenerator: React.FC<CharacterPoseGeneratorProps> = ({
  kidId,
  kidName,
  selfieBase64,
  styleId,
  onComplete,
  onError
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPose, setCurrentPose] = useState<string | null>(null);
  const [completedPoses, setCompletedPoses] = useState<string[]>([]);
  const [failedPoses, setFailedPoses] = useState<string[]>([]);
  const [poses, setPoses] = useState<{ [poseId: string]: PoseData }>({});
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const apiBase = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001' 
    : import.meta.env.VITE_API_BASE_URL?.replace('/api/', '') || 'https://backendgk2-0.onrender.com';

  // Start generation when component mounts
  useEffect(() => {
    generatePoses();
  }, []);

  const generatePoses = async () => {
    setIsGenerating(true);
    setError(null);
    setCompletedPoses([]);
    setFailedPoses([]);
    setPoses({});
    setProgress(0);

    try {
      console.log(`🎨 Starting pose generation for ${kidName}...`);

      const response = await fetch(`${apiBase}/api/character-poses/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfieBase64,
          styleId,
          kidId,
          kidName
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate poses');
      }

      if (data.success && data.poses) {
        const generatedPoses = data.poses;
        const completedIds = Object.keys(generatedPoses);
        const failedIds = POSE_ORDER.filter(id => !completedIds.includes(id));

        setPoses(generatedPoses);
        setCompletedPoses(completedIds);
        setFailedPoses(failedIds);
        setProgress(100);

        console.log(`✅ Generated ${completedIds.length}/${POSE_ORDER.length} poses`);

        // Call onComplete with the generated poses
        onComplete(generatedPoses);
      } else {
        throw new Error('No poses returned from server');
      }
    } catch (err: any) {
      console.error('❌ Pose generation error:', err);
      setError(err.message || 'Failed to generate character poses');
      onError?.(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Simulate progress during generation (since the backend generates all at once)
  useEffect(() => {
    if (isGenerating && progress < 95) {
      const interval = setInterval(() => {
        setProgress(prev => {
          // Slow down as we get closer to 95%
          const increment = Math.max(1, (95 - prev) / 10);
          return Math.min(95, prev + increment);
        });

        // Cycle through poses to show activity
        setCurrentPose(prev => {
          const currentIndex = prev ? POSE_ORDER.indexOf(prev) : -1;
          const nextIndex = (currentIndex + 1) % POSE_ORDER.length;
          return POSE_ORDER[nextIndex];
        });
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isGenerating, progress]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
          <Sparkles className="w-10 h-10 text-white animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Creating {kidName}'s Character
        </h2>
        <p className="text-white/70">
          {isGenerating 
            ? 'This may take a minute...' 
            : error 
              ? 'Something went wrong'
              : 'All poses generated!'
          }
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md mb-8">
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-white/50 text-sm mt-2">
          {Math.round(progress)}% complete
        </p>
      </div>

      {/* Pose Grid */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {POSE_ORDER.map((poseId) => {
          const isComplete = completedPoses.includes(poseId);
          const isFailed = failedPoses.includes(poseId);
          const isCurrent = currentPose === poseId && isGenerating;
          
          return (
            <div
              key={poseId}
              className={`
                relative w-14 h-14 rounded-xl flex items-center justify-center
                transition-all duration-300
                ${isComplete ? 'bg-green-500/20 border-2 border-green-500' : ''}
                ${isFailed ? 'bg-red-500/20 border-2 border-red-500' : ''}
                ${isCurrent ? 'bg-purple-500/30 border-2 border-purple-500 animate-pulse scale-110' : ''}
                ${!isComplete && !isFailed && !isCurrent ? 'bg-white/5 border-2 border-white/20' : ''}
              `}
            >
              <span className="text-2xl">{POSE_EMOJIS[poseId]}</span>
              
              {/* Status indicator */}
              {isComplete && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
              )}
              {isFailed && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <XCircle className="w-3 h-3 text-white" />
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current Status */}
      {isGenerating && currentPose && (
        <p className="text-white/60 text-sm animate-pulse">
          Creating {currentPose.replace('_', ' ')} pose...
        </p>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-4">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={generatePoses}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl text-white font-semibold transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
        </div>
      )}

      {/* Success State */}
      {!isGenerating && completedPoses.length > 0 && !error && (
        <div className="mt-4">
          <p className="text-green-400 mb-2">
            {completedPoses.length} of {POSE_ORDER.length} poses ready!
          </p>
          {failedPoses.length > 0 && (
            <p className="text-yellow-400 text-sm">
              {failedPoses.length} poses couldn't be generated. 
              They'll use a default image in stories.
            </p>
          )}
        </div>
      )}

      {/* Preview of Generated Poses */}
      {!isGenerating && completedPoses.length > 0 && (
        <div className="mt-6 w-full max-w-lg">
          <p className="text-white/50 text-sm mb-3">Preview:</p>
          <div className="flex justify-center gap-2 overflow-x-auto pb-2">
            {completedPoses.slice(0, 5).map(poseId => (
              <img
                key={poseId}
                src={poses[poseId]?.url}
                alt={poses[poseId]?.name}
                className="w-16 h-16 rounded-lg object-cover border-2 border-white/20"
              />
            ))}
            {completedPoses.length > 5 && (
              <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center text-white/50 text-sm">
                +{completedPoses.length - 5}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterPoseGenerator;
