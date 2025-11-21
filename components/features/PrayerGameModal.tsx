
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import WoodButton from '../ui/WoodButton';
import { 
  X, Star, Home, Users, Globe, HeartPulse, 
  CloudRain, Book, Send, Sparkles, Heart, Check, Mic, MicOff, ArrowRight
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useAudio } from '../../context/AudioContext';

interface PrayerGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GameState = 'intro' | 'selection' | 'focus' | 'success';

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
    "Papa God, thank You so much for my family! You gave them to me to love and hold. Please watch over them, keep them safe day and night.",
    "Dear Jesus, please bless my mom and dad today. Give them strength and joy. Help me to be a good helper in our house.",
    "Father God, thank You for my home. Please fill it with Your peace. Help us to be kind to one another and forgive quickly.",
    "Papa God, bless my brother and sister. Help us to play nicely and share our toys. Thank You for giving me a friend at home.",
    "Lord, thank You for my grandparents. Please keep them healthy and strong. I love them so much!",
    "God, please protect my family when we go out and when we come in. Be our shield and our safe place.",
    "Jesus, be the center of our family. Help us to love You more than anything else.",
    "Papa God, thank You for family dinners and time together. Bless the food we eat and the love we share.",
    "Father, help me to honor my parents and listen to what they say. Help me to have a happy heart when I obey.",
    "Lord, if anyone in my family is sad today, please comfort them with a big hug from You.",
    "God, help my family to serve You together. Show us how we can help others as a team.",
    "Papa God, thank You for the laughter and fun in my family. You are a good God!",
    "Jesus, help us to speak kind words to each other. Let our home be full of Your love.",
    "Father, thank You for picking this family just for me. I am so special to You and to them.",
    "God, help my family to trust You even when things are hard. We know You are taking care of us."
  ],
  friends: [
    "Papa God, thank You for my friends! Help me to be a kind and loving friend to them today.",
    "Jesus, please bless my best friend. Let them know how much You love them right now.",
    "Father, help me to share my things and take turns. Help me to show Jesus' love when I play.",
    "God, please give me wisdom to choose good friends who love You too.",
    "Lord, help me to include kids who might feel lonely or left out. Help me be a friend to everyone.",
    "Papa God, thank You for the fun times I have with my buddies. Thank You for laughter!",
    "Jesus, help me to forgive my friend if they hurt my feelings. Help us to make up and be happy again.",
    "Father, protect my friends at their homes. Keep them safe and healthy.",
    "God, help me to speak words that make my friends feel brave and happy, not sad.",
    "Lord, thank You that You are my Best Friend forever! You never leave me.",
    "Papa God, bless my friends at school and at church. Help them to know You.",
    "Jesus, help me to be a good listener when my friend is talking.",
    "Father, if my friend is sad, help me to know how to cheer them up.",
    "God, thank You for the gift of friendship. It makes life so fun!",
    "Lord, let my light shine so my friends can see how good You are."
  ],
  world: [
    "Papa God, You made the whole wide world! Thank You for the trees, the mountains, and the oceans.",
    "Jesus, please bring peace to countries that are fighting. Help them to put down their weapons and talk.",
    "Father, please feed the hungry people all over the world today. Show us how we can help.",
    "God, bless the leaders of our country and the world. Give them wisdom to make good choices.",
    "Lord, help people in every nation to know about Your great love for them.",
    "Papa God, protect the children all over the earth. Keep them safe from harm.",
    "Jesus, bless the missionaries who go far away to tell people about You. Keep them safe.",
    "Father, help us to take care of Your beautiful earth. Help us not to waste what You gave us.",
    "God, please heal the lands that are dry or hurting. Send rain where it is needed.",
    "Lord, let Your kingdom come and Your will be done on earth as it is in heaven.",
    "Papa God, thank You for all the different people and languages You created. You love them all!",
    "Jesus, shine Your light in the dark places of the world. Let Your truth be known.",
    "Father, help us to love our neighbors, even the ones who live far away.",
    "God, we pray for freedom for people who are trapped or scared. Set them free!",
    "Lord, thank You that You hold the whole world in Your hands."
  ],
  sick: [
    "Papa God, please heal my friend who is not feeling well. Touch their body and make it strong.",
    "Jesus, You are the Great Physician. We ask You to heal every sickness and pain.",
    "Father, please be with everyone in the hospital today. Help them not to be afraid.",
    "God, thank You for doctors and nurses. Give them wisdom to know how to help sick people.",
    "Lord, please take away the pain from those who are hurting. Give them rest.",
    "Papa God, heal my tummy ache/headache. Help me to feel full of energy again.",
    "Jesus, thank You that by Your stripes we are healed. We trust Your word.",
    "Father, give strength to bodies that are weak. Build them up again.",
    "God, protect my family from getting sick. Keep our immune systems strong!",
    "Lord, bless the medicine people take. Let it work quickly to help them.",
    "Papa God, comfort the people who are sad because they don't feel good. Be close to them.",
    "Jesus, restore health to my grandma/grandpa. We love them and want them well.",
    "Father, help me to be patient when I have to rest and get better.",
    "God, we speak life and health over every sickness in Jesus' name!",
    "Lord, thank You for the miracle of healing. You are powerful!"
  ],
  thanks: [
    "Papa God, thank You for this beautiful new day! Thank You for waking me up.",
    "Jesus, thank You for dying on the cross for me so I can be God's child.",
    "Father, thank You for the yummy food on my table. I am so full and happy.",
    "God, thank You for my warm bed and a roof over my head. You take good care of me.",
    "Lord, thank You for the sun that shines and the rain that waters the plants.",
    "Papa God, thank You for my clothes and my shoes. You provide everything I need.",
    "Jesus, thank You for loving me even when I make mistakes. Your grace is big.",
    "Father, thank You for the Bible so I can read about You.",
    "God, thank You for hearing my prayers. I know You are listening.",
    "Lord, thank You for my toys and for time to play. It is such a gift.",
    "Papa God, thank You for the birds that sing and the flowers that bloom.",
    "Jesus, thank You for being with me everywhere I go. I am never alone.",
    "Father, thank You for my brain that helps me learn and think.",
    "God, I am so grateful for all Your blessings. My heart is full of thanks!",
    "Lord, thank You for making me special and unique. There is no one else like me."
  ],
  sorry: [
    "Papa God, I am sorry for not listening to my parents today. Please forgive me.",
    "Jesus, I am sorry I got angry and lost my temper. Help me to have peace.",
    "Father, forgive me for saying mean words. Please wash my mouth and heart clean.",
    "God, I am sorry I disobeyed. Help me to choose the right way next time.",
    "Lord, forgive me for fighting with my siblings/friends. Help me to be a peacemaker.",
    "Papa God, I am sorry for being selfish and not sharing. Help me to have a generous heart.",
    "Jesus, thank You for forgiving me. Help me to forgive myself too.",
    "Father, I am sorry I lied. Help me to always speak the truth and be brave.",
    "God, forgive me for having a bad attitude. Give me a joyful spirit instead.",
    "Lord, I am sorry for complaining. Help me to be thankful for what I have.",
    "Papa God, show me if there is anything else I need to say sorry for.",
    "Jesus, create in me a clean heart. I want to make You happy.",
    "Father, I am sorry I forgot to pray. Thank You for waiting for me.",
    "God, help me to say sorry to the people I hurt, too.",
    "Lord, thank You that Your mercies are new every morning. I love You."
  ],
  school: [
    "Papa God, help me to learn new things today! Open my mind to understand.",
    "Jesus, help me to focus and listen to my teacher. Help me not to get distracted.",
    "Father, give me a smart mind to solve problems and read well.",
    "God, thank You for my school and my classmates. Bless them today.",
    "Lord, help me to do my homework with a good attitude. Help me work hard.",
    "Papa God, help me when learning is tricky. Remind me that I can do hard things!",
    "Jesus, give me wisdom and understanding. You are the source of all truth.",
    "Father, help me to be a good example at school. Let my light shine.",
    "God, protect my school and keep us all safe while we learn.",
    "Lord, thank You for books and stories. Learning is a gift from You.",
    "Papa God, help me to use my brain to do good things for Your kingdom.",
    "Jesus, help me to be kind on the playground and include everyone.",
    "Father, bless my teacher with patience, joy, and strength today.",
    "God, help me to remember what I study so I can use it later.",
    "Lord, let me grow in wisdom and stature, just like Jesus did."
  ],
  love: [
    "Papa God, help me to love others just like You love me—big and unconditional.",
    "Jesus, fill my heart with Your love today. Let it overflow to everyone I meet.",
    "Father, help me to be patient and kind, not jealous or proud.",
    "God, thank You that Your love never fails. It is always there for me.",
    "Lord, help me to love people who are hard to love. Give me Your eyes to see them.",
    "Papa God, show me how to serve others in love today. Help me be a helper.",
    "Jesus, thank You for loving me first, even before I knew You.",
    "Father, let everything I do today be done in love.",
    "God, help me to share Your love with my friends who don't know You yet.",
    "Lord, cast out all fear from my heart with Your perfect love.",
    "Papa God, help me to love my neighbor as myself.",
    "Jesus, Your love is better than life! It is sweeter than honey.",
    "Father, help me to forgive in love, just like You forgave me.",
    "God, let my life be a picture of Your love to the world.",
    "Lord, thank You that nothing can ever separate me from Your love."
  ]
};

const PrayerGameModal: React.FC<PrayerGameModalProps> = ({ isOpen, onClose }) => {
  const { addCoins } = useUser();
  const { playClick, playSuccess, playTab, setGameMode } = useAudio();
  
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
          
          // Initialize Mic if needed
          if (!audioContextRef.current) {
              await startListening();
          }
          
          setGameState('focus');
      }
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
    addCoins(30); 
    setTimeout(() => {
        onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  const activeTopic = selectedTopics[currentTopicIndex];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pointer-events-auto">
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

              {/* --- FOCUS / PRAYING --- */}
              {gameState === 'focus' && activeTopic && (
                  <div className="flex flex-col items-center justify-center w-full h-full flex-1 animate-in zoom-in duration-500">
                      
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

                      <h3 className="text-2xl font-display font-bold text-white mb-2 animate-pulse">
                          {activeTopic.label}
                      </h3>
                      <p className="text-[#e1bee7] text-center mb-4 px-4 leading-relaxed">
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