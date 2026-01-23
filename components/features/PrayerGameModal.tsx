
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import WoodButton from '../ui/WoodButton';
import { 
  X, Star, Home, Users, Globe, HeartPulse, 
  CloudRain, Book, Send, Sparkles, Heart, Check, Mic, MicOff, ArrowRight
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';

interface PrayerGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GameState = 'intro' | 'selection' | 'instruction' | 'focus' | 'success';

// --- DATA COLLECTIONS ---

const PRAYER_TOPICS = [
  { id: 'family', label: 'My Family', icon: Home, color: 'bg-[#4FC3F7]' },
  { id: 'friends', label: 'My Friends', icon: Users, color: 'bg-[#F06292]' },
  { id: 'world', label: 'The World', icon: Globe, color: 'bg-[#66BB6A]' },
  { id: 'sick', label: 'Healing', icon: HeartPulse, color: 'bg-[#EF5350]' },
  { id: 'thanks', label: 'Thank You', icon: Star, color: 'bg-[#FFCA28]' },
  { id: 'sorry', label: 'I\'m Sorry', icon: CloudRain, color: 'bg-[#78909C]' },
  { id: 'school', label: 'Learning', icon: Book, color: 'bg-[#AB47BC]' },
  { id: 'love', label: 'Love', icon: Heart, color: 'bg-[#EC407A]' },
];

const PRAYER_TEXTS: Record<string, string[]> = {
  family: [
    "Papa God, thank You for my family! I love them so much. Please keep them safe and happy. Help us to love each other and be kind. I am so glad You gave me my family!",
    "Dear Jesus, please bless my mom and dad today. Help them to be strong and happy. Help me to be a good helper at home. Thank You for parents who love me!",
    "Father God, thank You for my home. Please fill it with love and happiness. Help everyone in my family to be nice to each other. We love You, God!",
    "Papa God, bless my brother and sister. Help us to play nicely and share our toys. Thank You for giving me friends in my own home!",
    "Lord, thank You for my grandma and grandpa. Please keep them healthy and strong. I love spending time with them. They are so special to me!",
    "God, please keep my family safe wherever we go. Send Your angels to watch over us. Thank You for always taking care of us!",
    "Jesus, help my family to love You very much. Help us to pray together and read the Bible together. We want to follow You!",
    "Papa God, thank You for dinner time with my family. Thank You for the yummy food. Help us to talk and laugh together. Family time is the best!"
  ],
  friends: [
    "Papa God, thank You for my friends! They make me so happy. Help me to be a good friend. Help me to share and be kind to them every day!",
    "Jesus, please bless my best friend today. Help them to know how much You love them. Thank You for bringing them into my life!",
    "Father, help me to share my toys and take turns. Help me to be nice when we play games. Give me a happy heart that loves to share!",
    "God, help me to pick good friends who love You. Help me to be a good friend too. Thank You for all my wonderful friends!",
    "Lord, help me to be friends with kids who are lonely. Help me to invite them to play. I want to show Your love to everyone!",
    "Papa God, thank You for all the fun times with my friends. Thank You for the giggles and games. Help us to have more happy days together!",
    "Jesus, help me to forgive my friend if they hurt my feelings. Help us to say sorry and be friends again. I want to always make up!",
    "Father, please keep my friends safe and healthy. Watch over their families too. Help them to feel Your love every single day!"
  ],
  world: [
    "Papa God, You made the whole world! Thank You for the trees, the mountains, the ocean, and all the animals. Help us to take good care of everything You made!",
    "Jesus, please bring peace to places where people are fighting. Help everyone to be kind and stop hurting each other. You are the Prince of Peace!",
    "Father, please give food to hungry kids all over the world. Give them clean water to drink. Show me how I can help people who need it!",
    "God, please help the leaders of our country to make good choices. Help them to be fair and kind to everyone!",
    "Lord, help people everywhere to learn about Your love. Send helpers to tell them about Jesus. Let Your love reach every person!",
    "Papa God, please keep all the children in the world safe today. Give them food, homes, and people who love them. Every kid is special to You!",
    "Jesus, please take care of the people who travel far away to tell others about You. Keep them safe and give them what they need!",
    "Father, help us to take care of Your beautiful earth. Help us not to waste things. We want to be good helpers of the world You made!"
  ],
  sick: [
    "Papa God, please make my friend feel better. Help their body to get strong again. Take away their owies and give them rest. Be close to them today!",
    "Jesus, You can heal anyone! Please make sick people well again. Take away their pain and make them strong. We know You can do it!",
    "Father, please be with the kids in the hospital. Help them not to be scared. Send nice doctors and nurses to help them. Give their families peace!",
    "God, thank You for doctors and nurses who help sick people. Help them to know just what to do. Bless them for caring for others!",
    "Lord, please take away the hurt from people who are in pain. Help them to rest well and feel better soon. Hug them close like a warm blanket!",
    "Papa God, please make my tummy ache go away. Help me to feel better soon. Thank You that You care about even my little owies!",
    "Jesus, Your Bible says You can heal us. We believe You want us to be well. Please help sick people get better. We trust You!",
    "Father, please give strength to people who feel weak and tired. Make their bodies strong again. Thank You for taking care of us!"
  ],
  thanks: [
    "Papa God, thank You for this awesome day! Thank You for waking me up happy and healthy. Thank You for everything good You have for me today!",
    "Jesus, thank You for loving me so much that You died for me. Now I can be God's kid forever! Your love is SO big! Thank You!",
    "Father, thank You for the yummy food on my plate. I love it! Thank You for everyone who helped make my food. You give me everything I need!",
    "God, thank You for my cozy bed and my warm house. You take such good care of me and my family! I am so thankful!",
    "Lord, thank You for the sunny days and the rainy days. Thank You for all the seasons. You made everything so beautiful!",
    "Papa God, thank You for my clothes and shoes and all my stuff. You give me so many good things! Help me to always say thank You!",
    "Jesus, thank You for loving me even when I mess up. You always give me another chance. Your love is amazing! Thank You!",
    "Father, thank You for the Bible so I can learn about You. Thank You for Your stories and promises. Help me to read it and love it!"
  ],
  sorry: [
    "Papa God, I am sorry I did not listen to my mom and dad. Please forgive me. Help me to obey next time. Thank You for loving me anyway!",
    "Jesus, I am sorry I got mad and yelled. Help me to stay calm when things are hard. Help me to be kind instead of angry. I want to be like You!",
    "Father, forgive me for saying mean words. I am sorry I hurt someone's feelings. Help me to only say nice things that make people happy!",
    "God, I am sorry I made a bad choice. Help me to do the right thing next time. I want to make You proud of me!",
    "Lord, forgive me for fighting with my brother or sister. Help me to get along with them. Help me to say sorry when I am wrong!",
    "Papa God, I am sorry for not wanting to share. Help me to have a giving heart like You. Help me to share my things with others!",
    "Jesus, thank You for forgiving me when I mess up. Help me to forgive myself too. Your love makes everything okay again!",
    "Father, I am sorry I told a lie. Help me to always tell the truth, even when it is hard. The truth is always better than a lie!"
  ],
  school: [
    "Papa God, help me to learn new things today! Help my brain to understand and remember. I want to learn lots of cool stuff!",
    "Jesus, help me to listen to my teacher and pay attention. Help me not to get distracted. I want to do my very best in class!",
    "Father, help me to be good at reading and math. Thank You for my brain! Help me to work hard even when it is tricky!",
    "God, thank You for my school and my teachers and my friends in class. Bless them all today! Make our classroom a happy place!",
    "Lord, help me to do my homework without complaining. Help me to try my best and not rush. I know working hard is good!",
    "Papa God, help me when learning gets hard and I want to give up. Remind me that I can do hard things with Your help! You made me smart!",
    "Jesus, give me wisdom that comes from You. Help me to think clearly and understand my lessons. You know everything!",
    "Father, help me to be kind and honest at school. Let other kids see Jesus in me. I want to be a good example!"
  ],
  love: [
    "Papa God, help me to love others the way You love me—so much and forever! Fill my heart with so much love that it spills over to everyone!",
    "Jesus, fill my heart with Your love today! Help people to feel how much You love them through me. Make me a love-giver!",
    "Father, help me to be patient and kind, not jealous or show-offy. Help me to be happy when good things happen to others!",
    "God, thank You that Your love never stops! Even on my worst days, You still love me the same. Your love is the best! Thank You!",
    "Lord, help me to love people who are hard to love. Help me to be kind even when others are mean. Change my heart to be more like Yours!",
    "Papa God, show me how to help others today. Help me to look for ways to make people smile. I want to share Your love everywhere!",
    "Jesus, thank You for loving me first, before I even knew You. Help me to love others the same way—without them having to do anything!",
    "Father, help everything I do today to be done with love. My words, my actions, everything! When I want to be mean, help me to choose love!"
  ]
};

const PrayerGameModal: React.FC<PrayerGameModalProps> = ({ isOpen, onClose }) => {
  const { addCoins } = useUser();
  const { playClick, playSuccess, playTab, setGameMode, currentPlaylist } = useAudio();
  const { t } = useLanguage();
  
  // Check if MiniPlayer is visible (playlist is playing)
  const hasMiniPlayer = !!currentPlaylist;
  
  const [gameState, setGameState] = useState<GameState>('intro');
  const [isClaiming, setIsClaiming] = useState(false);
  
  // Store topics with their assigned random text
  const [selectedTopics, setSelectedTopics] = useState<(typeof PRAYER_TOPICS[0] & { text: string })[]>([]);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isPrayerFilled, setIsPrayerFilled] = useState(false);
  
  // Refs for Loop Logic (prevents stale closures)
  const progressRef = useRef(0);
  const isHoldingRef = useRef(false);
  const loopRunningRef = useRef(false);
  const isPrayerFilledRef = useRef(false);
  
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // --- SETUP ---
  useEffect(() => {
    if (isOpen) {
      setGameMode(false); // Stop all music for prayer time (pauses all tracks)
      initializeGame();
    } else {
      // Don't call setGameMode here - let it return to background music naturally
      setGameState('intro');
      cleanup();
    }
    return cleanup;
  }, [isOpen, setGameMode]);

  // Cleanup function
  const cleanup = () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      loopRunningRef.current = false;
      
      if (microphoneStreamRef.current) {
          microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
      }
      audioContextRef.current = null;
      analyserRef.current = null;
      microphoneStreamRef.current = null;
  };

  const initializeGame = () => {
      setGameState('intro');
      setIsClaiming(false);
      setSelectedTopics([]);
      setCurrentTopicIndex(0);
      setHoldProgress(0);
      setIsPrayerFilled(false);
      progressRef.current = 0;
      isHoldingRef.current = false;
      isPrayerFilledRef.current = false;
      setVolume(0);
      setIsSpeaking(false);
  };

  // --- GAME LOOP ---
  const runGameLoop = () => {
      if (!loopRunningRef.current) return;

      // Stop if already filled
      if (progressRef.current >= 100) {
          if (!isPrayerFilledRef.current) { 
             isPrayerFilledRef.current = true;
             setIsPrayerFilled(true);
             setIsSpeaking(false);
             playSuccess();
          }
          return; 
      }

      let inputBoost = 0;

      // 1. Microphone Input
      if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setVolume(average); // For visual feedback

          if (average > 25) {
              setIsSpeaking(true);
              inputBoost += 0.15; 
          } else {
              setIsSpeaking(false);
          }
      }

      // 2. Manual Hold Input
      if (isHoldingRef.current) {
          inputBoost += 0.2; 
      }

      // Apply Progress
      if (inputBoost > 0) {
          progressRef.current = Math.min(100, progressRef.current + inputBoost);
          setHoldProgress(progressRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(runGameLoop);
  };

  const forceCompletePrayer = () => {
      progressRef.current = 100;
      setHoldProgress(100);
      if (!isPrayerFilledRef.current) {
             isPrayerFilledRef.current = true;
             setIsPrayerFilled(true);
             setIsSpeaking(false);
             playSuccess();
      }
  };

  const startListening = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          microphoneStreamRef.current = stream;
          setMicPermission(true);

          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioCtx;
          
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
          }

      } catch (err) {
          console.error("Microphone access denied or error:", err);
          setMicPermission(false);
      }
  };

  // --- USER INTERACTIONS ---

  const setHolding = (holding: boolean) => {
      // Only allow holding if not finished
      if (!isPrayerFilledRef.current) {
          isHoldingRef.current = holding;
      }
  };

  const handleTopicSelect = (topic: typeof PRAYER_TOPICS[0]) => {
      if (selectedTopics.find(t => t.id === topic.id)) {
          // Deselect
          setSelectedTopics(prev => prev.filter(t => t.id !== topic.id));
          playClick();
      } else {
          if (selectedTopics.length < 3) {
              // Select Random Text for this session
              const texts = PRAYER_TEXTS[topic.id] || ["Thank You God."];
              const randomText = texts[Math.floor(Math.random() * texts.length)];
              
              setSelectedTopics(prev => [...prev, { ...topic, text: randomText }]);
              playTab();
          }
      }
  };

  const startPrayer = async () => {
      if (selectedTopics.length > 0) {
          playClick();
          setGameState('instruction');
      }
  };

  const beginPrayingFocus = async () => {
      playClick();
      
      // Initialize Mic if needed
      if (!audioContextRef.current) {
          await startListening();
      }
      
      setGameState('focus');
  };

  // Restart loop when we enter focus mode or switch topics
  useEffect(() => {
      if (gameState === 'focus' && !isClaiming) {
          // Reset Progress State Completely
          progressRef.current = 0;
          setHoldProgress(0);
          isHoldingRef.current = false;
          isPrayerFilledRef.current = false;
          setIsPrayerFilled(false);
          loopRunningRef.current = true;
          
          // Start Loop
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          runGameLoop();
      }

      return () => {
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          loopRunningRef.current = false;
      };
  }, [gameState, currentTopicIndex]);


  const nextPrayer = () => {
      playClick();
      
      // Delay slightly for transition effect
      setTimeout(() => {
          if (currentTopicIndex < selectedTopics.length - 1) {
              setCurrentTopicIndex(prev => prev + 1);
              // Effect hook will reset progress and restart loop
          } else {
              setGameState('success');
              cleanup();
          }
      }, 200);
  };

  const handleClaim = () => {
    setIsClaiming(true);
    addCoins(30, 'Prayer Time Complete', 'game'); 
    setTimeout(() => {
        onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  const activeTopic = selectedTopics[currentTopicIndex];

  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-center justify-center px-4 pointer-events-auto ${hasMiniPlayer ? 'pb-20' : ''}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#1a103c]/90 backdrop-blur-md animate-in fade-in duration-300"
        onClick={gameState === 'success' && !isClaiming ? onClose : undefined}
      >
          {/* Stars Background */}
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      </div>

      {/* FLYING COINS ANIMATION */}
      {isClaiming && (
        <div className="fixed inset-0 pointer-events-none z-[150]">
             {[...Array(12)].map((_, i) => (
                 <div 
                    key={i}
                    className="absolute w-8 h-8 bg-[#FFD700] border-2 border-[#B8860B] rounded-full shadow-xl flex items-center justify-center text-[#B8860B] font-bold text-xs z-[150]"
                    style={{
                        top: '50%',
                        left: '50%',
                        animation: `flyCoin 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
                        animationDelay: `${i * 0.05}s`,
                        '--scatter-x': `${(Math.random() - 0.5) * 300}px`,
                        '--scatter-y': `${(Math.random() - 0.5) * 300}px`,
                    } as React.CSSProperties}
                 >
                    $
                 </div>
             ))}
        </div>
      )}

      {/* Main Card */}
      <div className={`
         relative w-full max-w-sm bg-[#4a148c] rounded-[2rem] p-1 border-4 border-[#7b1fa2] shadow-2xl 
         transition-all duration-500 transform overflow-hidden flex flex-col
         ${isClaiming ? 'scale-90 opacity-0 duration-700' : 'animate-in zoom-in-95 slide-in-from-bottom-10'}
      `}>
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 bg-black/20 hover:bg-black/40 text-white/70 rounded-full p-2 transition-colors"
          >
            <X size={20} />
          </button>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center pt-8 pb-8 px-6 text-center min-h-[500px]">
              
              {/* Title */}
              <h2 className="font-display font-extrabold text-2xl text-[#e1bee7] drop-shadow-md tracking-wide mb-2 uppercase flex items-center gap-2">
                 <Sparkles size={20} className="text-[#ab47bc]" /> Prayer Time
              </h2>

              {/* --- INTRO / SELECTION --- */}
              {(gameState === 'intro' || gameState === 'selection') && (
                  <div className="flex flex-col items-center w-full h-full flex-1 animate-in fade-in slide-in-from-bottom-4">
                      <p className="text-[#e1bee7]/80 text-sm mb-6 font-medium">
                          Pick <span className="text-white font-bold">3 things</span> to pray for today.
                      </p>

                      {/* Bubbles Grid */}
                      <div className="grid grid-cols-3 gap-3 w-full mb-6">
                          {PRAYER_TOPICS.map((topic) => {
                              const isSelected = selectedTopics.find(t => t.id === topic.id);
                              const isDisabled = !isSelected && selectedTopics.length >= 3;
                              
                              return (
                                  <button
                                      key={topic.id}
                                      onClick={() => handleTopicSelect(topic)}
                                      disabled={isDisabled}
                                      className={`
                                          aspect-square rounded-full flex flex-col items-center justify-center gap-1
                                          transition-all duration-300 relative
                                          ${isSelected ? 'scale-110 shadow-[0_0_15px_rgba(255,255,255,0.4)] z-10' : 'scale-100'}
                                          ${isDisabled ? 'opacity-40 grayscale' : 'opacity-100'}
                                          ${topic.color}
                                      `}
                                  >
                                      <topic.icon size={24} className="text-white drop-shadow-md" />
                                      <span className="text-[9px] font-bold text-white uppercase tracking-wide drop-shadow-sm">{topic.label}</span>
                                      
                                      {isSelected && (
                                          <div className="absolute -top-1 -right-1 bg-white text-[#4a148c] rounded-full p-0.5 shadow-md">
                                              <Check size={12} strokeWidth={4} />
                                          </div>
                                      )}
                                  </button>
                              );
                          })}
                      </div>

                      <div className="mt-auto w-full">
                          <div className="flex justify-center gap-2 mb-4">
                              {[0, 1, 2].map(i => (
                                  <div key={i} className={`w-3 h-3 rounded-full border border-white/30 transition-colors ${i < selectedTopics.length ? 'bg-white' : 'bg-transparent'}`}></div>
                              ))}
                          </div>
                          
                          <WoodButton 
                            onClick={startPrayer} 
                            variant="primary" 
                            fullWidth
                            disabled={selectedTopics.length === 0}
                            className={`bg-[#7b1fa2] hover:bg-[#8e24aa] border-[#4a148c] py-4 text-xl ${selectedTopics.length === 0 ? 'opacity-50' : ''}`}
                          >
                              BEGIN PRAYER
                          </WoodButton>
                      </div>
                  </div>
              )}

              {/* --- INSTRUCTION SCREEN --- */}
              {gameState === 'instruction' && (
                  <div className="flex flex-col items-center justify-center w-full h-full flex-1 animate-in fade-in zoom-in duration-500">
                      
                      {/* Praying Hands / Mic Icon */}
                      <div className="relative mb-8">
                          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#7b1fa2] to-[#4a148c] flex items-center justify-center shadow-2xl border-4 border-[#ab47bc]">
                              <Mic size={56} className="text-white drop-shadow-lg" />
                          </div>
                          <div className="absolute -top-2 -right-2 bg-[#FFD700] rounded-full p-2 shadow-lg animate-bounce">
                              <Sparkles size={20} className="text-[#B8860B]" />
                          </div>
                      </div>

                      <h3 className="font-display font-bold text-2xl text-white mb-4 text-center">
                          Read the Prayer<br/>Out Loud!
                      </h3>
                      
                      <div className="bg-black/30 rounded-2xl p-5 mb-8 border border-white/20 max-w-[280px]">
                          <p className="text-[#e1bee7] text-center leading-relaxed">
                              When the prayer appears, <span className="text-white font-bold">speak it with your voice</span>. God loves to hear you pray!
                          </p>
                          <div className="flex items-center justify-center gap-2 mt-4 text-[#ab47bc]">
                              <div className="w-2 h-2 rounded-full bg-[#ab47bc] animate-pulse"></div>
                              <span className="text-xs font-bold uppercase tracking-wide">Microphone will listen</span>
                          </div>
                      </div>

                      <div className="w-full px-4">
                          <WoodButton 
                              onClick={beginPrayingFocus}
                              variant="gold"
                              fullWidth
                              className="py-4 text-xl shadow-[0_0_20px_#FFD700]"
                          >
                              OK, I'M READY!
                          </WoodButton>
                      </div>
                  </div>
              )}

              {/* --- FOCUS / PRAYING --- */}
              {gameState === 'focus' && activeTopic && (
                  <div className="flex flex-col items-center w-full h-full flex-1 animate-in zoom-in duration-500 overflow-y-auto">
                      
                      {/* Progress Header */}
                      <div className="text-[#e1bee7]/50 text-xs font-bold uppercase tracking-widest mb-8">
                          Prayer {currentTopicIndex + 1} of {selectedTopics.length}
                      </div>

                      {/* Active Bubble with Voice Reactivity */}
                      <div className="relative mb-8">
                          {/* Voice Glowing Ring */}
                          <div 
                            className="absolute inset-0 rounded-full blur-xl transition-all duration-100"
                            style={{ 
                                backgroundColor: isSpeaking ? '#ab47bc' : (isHoldingRef.current ? 'white' : 'transparent'),
                                opacity: isSpeaking ? Math.min(0.8, volume / 30) : (isHoldingRef.current ? 0.4 : 0),
                                transform: isSpeaking ? `scale(${1 + volume/80})` : 'scale(1.5)'
                            }}
                          ></div>

                          {/* The Bubble - Animates out when filled */}
                          <div className={`
                              w-40 h-40 rounded-full flex items-center justify-center shadow-2xl z-10 relative
                              transition-all duration-1000 ease-in-out
                              ${isPrayerFilled ? 'scale-110 ring-8 ring-[#FFD700] ring-offset-4 ring-offset-[#4a148c]' : ''}
                              ${activeTopic.color}
                          `}>
                              {isPrayerFilled ? (
                                  <Check size={80} className="text-white animate-in zoom-in" strokeWidth={4} />
                              ) : (
                                  <activeTopic.icon size={64} className="text-white drop-shadow-lg" />
                              )}
                          </div>
                      </div>

                      <h3 className="text-3xl font-display font-bold text-white mb-3 animate-pulse">
                          {activeTopic.label}
                      </h3>
                      <p className="text-white text-xl text-center mb-4 px-2 leading-relaxed font-medium">
                          {activeTopic.text}
                      </p>

                      {/* Voice Instruction (Hide when filled) */}
                      {micPermission !== false && !isPrayerFilled && (
                          <div className="flex items-center gap-2 mb-6 bg-black/20 px-4 py-2 rounded-full border border-white/10">
                              <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-white/50'}`}></div>
                              <span className="text-xs font-bold text-white/80 uppercase tracking-wide">
                                  {isSpeaking ? "Listening..." : "Read out loud"}
                              </span>
                              <Mic size={14} className="text-white/60" />
                          </div>
                      )}

                      {/* Controls: Hold Button OR Amen Button */}
                      {isPrayerFilled ? (
                          <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-500 mt-4">
                              <WoodButton 
                                  onClick={nextPrayer}
                                  variant="gold"
                                  fullWidth
                                  className="py-4 text-xl shadow-[0_0_20px_#FFD700]"
                              >
                                  AMEN!
                              </WoodButton>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center w-full">
                              <div className="relative w-full max-w-[200px] h-16 select-none mt-2">
                                  <button
                                      onMouseDown={() => setHolding(true)}
                                      onMouseUp={() => setHolding(false)}
                                      onMouseLeave={() => setHolding(false)}
                                      onTouchStart={() => setHolding(true)}
                                      onTouchEnd={() => setHolding(false)}
                                      className="absolute inset-0 w-full h-full bg-[#311b92] rounded-full border-2 border-[#7b1fa2] flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
                                  >
                                      {/* Fill Bar */}
                                      <div 
                                        className="absolute inset-0 bg-[#ab47bc] origin-left transition-all duration-100 linear"
                                        style={{ width: `${holdProgress}%` }}
                                      ></div>
                                      
                                      <span className="relative z-10 font-display font-bold text-white tracking-wide flex items-center gap-2 text-sm">
                                          {micPermission === false ? "HOLD TO PRAY" : "SPEAK OR HOLD"}
                                          <Mic size={16} />
                                      </span>
                                  </button>
                                  {micPermission === false && (
                                      <p className="text-[10px] text-red-300 mt-2 font-bold text-center">Mic disabled. Press button.</p>
                                  )}
                              </div>
                              {/* Manual Amen Button */}
                              <button 
                                onClick={forceCompletePrayer}
                                className="mt-4 text-[#e1bee7]/60 hover:text-white text-xs font-bold uppercase tracking-wider border-b border-transparent hover:border-white/50 transition-all"
                              >
                                Manual Amen
                              </button>
                          </div>
                      )}
                      
                  </div>
              )}

              {/* --- SUCCESS --- */}
              {gameState === 'success' && (
                  <div className="flex flex-col items-center justify-center flex-1 w-full animate-in zoom-in duration-500">
                      <div className="relative w-32 h-32 mb-6">
                           <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                           <div className="absolute inset-0 flex items-center justify-center">
                               <Heart size={80} className="text-[#f06292] fill-[#f06292]" />
                           </div>
                           <div className="absolute -top-2 -right-2 animate-bounce">
                               <Sparkles size={32} className="text-[#FFD700]" />
                           </div>
                      </div>

                      <h3 className="font-display font-bold text-3xl text-white mb-2">PRAYERS SENT!</h3>
                      <p className="text-[#e1bee7] font-sans font-medium mb-8">
                          You spoke from your heart.<br/>God loves to hear your voice!
                      </p>
                      
                      <div className="flex gap-2 mb-8">
                          <Star size={40} fill="#FFD700" className="text-[#FFD700] drop-shadow-lg scale-110" strokeWidth={2} />
                          <Star size={40} fill="#FFD700" className="text-[#FFD700] drop-shadow-lg scale-125 -mt-4" strokeWidth={2} />
                          <Star size={40} fill="#FFD700" className="text-[#FFD700] drop-shadow-lg scale-110" strokeWidth={2} />
                      </div>

                      <div className="w-full px-8">
                          <WoodButton variant="gold" fullWidth onClick={handleClaim} className="py-4 text-xl shadow-[0_0_20px_#FFD700]">
                              CLAIM 30 COINS
                          </WoodButton>
                      </div>
                  </div>
              )}

          </div>
      </div>
      <style>{`
        @keyframes flyCoin {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          20% { transform: translate(calc(-50% + var(--scatter-x)), calc(-50% + var(--scatter-y))) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + 200px), -600px) scale(0.5); opacity: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default PrayerGameModal;