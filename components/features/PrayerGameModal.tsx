
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
    "Papa God, thank You so much for my family! You gave them to me to love and hold. Please watch over them and keep them safe day and night. Help us to always stick together and support each other through good times and hard times. I love my family so much!",
    "Dear Jesus, please bless my mom and dad today. Give them strength and joy in everything they do. Help me to be a good helper in our house and to always listen when they teach me. Thank You for giving me parents who love me and take care of me every single day.",
    "Father God, thank You for my home and the roof over my head. Please fill our house with Your peace and love. Help everyone in my family to be kind to one another, to forgive quickly when we make mistakes, and to always remember how much You love us all.",
    "Papa God, bless my brother and sister today. Help us to play nicely together, to share our toys without fighting, and to be best friends. Thank You for giving me friends right in my own home. Help us to laugh together and build happy memories.",
    "Lord, thank You for my grandparents and all the love they give me. Please keep them healthy and strong for many more years. Give them joy in their hearts and help me to spend time with them whenever I can. I love them so much and I am so thankful for them!",
    "God, please protect my family when we go out and when we come back home. Be our shield and our safe place in every situation. Surround us with Your angels and keep danger far away from us. Thank You for always watching over us.",
    "Jesus, be the center of our family and our home. Help us to love You more than anything else in the world. Teach us to pray together, read Your Word together, and grow closer to You as a family. Let our home bring glory to Your name.",
    "Papa God, thank You for family dinners and special time together. Bless the food we eat and the conversations we share. Help us to put down our screens and really talk to each other. Thank You for the gift of being together as a family."
  ],
  friends: [
    "Papa God, thank You for my friends! They make my life so much fun and happy. Help me to be a kind and loving friend to them today and every day. Show me how to encourage them, share with them, and be there when they need me. Thank You for the gift of friendship!",
    "Jesus, please bless my best friend today. Let them know how much You love them and how special they are. Help our friendship to grow stronger and help us to always be honest and kind to each other. Thank You for bringing them into my life.",
    "Father, help me to share my things and take turns without complaining. Help me to show Jesus' love when I play with my friends. When we disagree, help us to work it out and still be friends. Give me a generous heart that loves to share.",
    "God, please give me wisdom to choose good friends who love You too. Help me to be a good influence on others and to stand up for what is right. Surround me with friends who will help me grow closer to You and become the best version of myself.",
    "Lord, help me to include kids who might feel lonely or left out. Give me eyes to see the kid sitting alone and courage to invite them to play. Help me be a friend to everyone, not just the popular kids. Let me show Your love to all.",
    "Papa God, thank You for all the fun times and adventures I have with my friends. Thank You for the laughter, the games, and the silly moments we share. Help us to make even more happy memories together and to always treasure our friendship.",
    "Jesus, help me to forgive my friend quickly if they hurt my feelings. Help us to say sorry and make up so our friendship stays strong. Teach me that forgiveness is more important than being right. Help us to always work things out.",
    "Father, protect my friends at their homes and wherever they go. Keep them safe and healthy. Watch over their families too. I pray that they would feel Your love surrounding them every moment of every day."
  ],
  world: [
    "Papa God, You made the whole wide world and everything in it! Thank You for the beautiful trees, the tall mountains, the deep oceans, and all the amazing animals. Help us to take good care of Your creation and to appreciate the beauty You made for us to enjoy.",
    "Jesus, please bring peace to countries that are fighting and hurting. Help the leaders to put down their weapons and choose to talk instead. Comfort the families who are scared and bring healing to lands that have been damaged by war. You are the Prince of Peace!",
    "Father, please feed the hungry people all over the world today. Provide food for the children who have empty tummies and clean water for those who are thirsty. Show me and my family how we can help those in need. Give us generous hearts.",
    "God, bless the leaders of our country and all the leaders around the world. Give them wisdom to make good choices that help people. Help them to be honest and fair. Put good advisors around them and let justice and peace rule in every land.",
    "Lord, help people in every nation to hear about Your great love for them. Send brave missionaries to share the good news of Jesus. Open the hearts of people who have never heard Your name. Let Your light shine in every corner of the earth.",
    "Papa God, protect the children all over the earth today. Keep them safe from harm, from sickness, and from people who might hurt them. Give them food to eat, homes to live in, and people who love them. Every child is precious to You.",
    "Jesus, bless the missionaries who leave their homes and go far away to tell people about You. Keep them safe and healthy. Give them courage when things are hard and joy when they see people come to know You. Provide everything they need.",
    "Father, help us to take good care of Your beautiful earth. Help us not to waste food, water, or energy. Show us how to recycle and protect the animals and plants You created. We want to be good stewards of this amazing world You gave us."
  ],
  sick: [
    "Papa God, please heal my friend who is not feeling well. Touch their body with Your healing power and make them strong again. Take away their pain and give them rest. Be close to them and let them feel Your loving presence surrounding them today.",
    "Jesus, You are the Great Physician and nothing is too hard for You. We ask You to heal every sickness and take away every pain. Restore health to bodies that are weak and fill them with energy and strength. We believe in Your healing power!",
    "Father, please be with everyone in the hospital today, especially the kids. Help them not to be afraid. Send kind nurses and wise doctors to take care of them. Comfort their families who are worried. Let Your peace fill every hospital room.",
    "God, thank You for doctors, nurses, and all the people who help sick people get better. Give them wisdom to know exactly what to do. Help them to be kind and patient. Bless their hands as they care for the sick and give them energy for long days.",
    "Lord, please take away the pain from those who are hurting today. Give them peaceful rest and sweet sleep. Help their bodies to heal quickly. Wrap them in Your comfort like a warm blanket and remind them that You are right there with them.",
    "Papa God, heal my tummy ache and headache and help me feel full of energy again. Thank You that You care about every part of me, even the small hurts. Help me to rest and drink water and do what I need to do to get better. I trust You!",
    "Jesus, thank You that by Your stripes we are healed. Your Word says You took our sicknesses and carried our pain. We trust in Your promises and believe that You want us to be well. Help us to have faith even when healing takes time.",
    "Father, give strength to bodies that are weak and tired. Build them up again with Your mighty power. Restore what sickness has stolen. We speak life and health over every sick person in Jesus' powerful name! Thank You for the miracle of healing."
  ],
  thanks: [
    "Papa God, thank You for this beautiful new day! Thank You for waking me up healthy and strong. Thank You for the air I breathe, the sun that shines, and all the wonderful things You have planned for me today. I am so grateful to be alive!",
    "Jesus, thank You for dying on the cross for me so I can be God's child forever. Thank You for taking my punishment and giving me eternal life. Your love for me is so big I can hardly understand it! I am so thankful to belong to You.",
    "Father, thank You for the yummy food on my table. I am so full and happy! Thank You for the farmers who grow the food and the people who prepare it. Help me to never take my meals for granted. You are such a good provider!",
    "God, thank You for my warm bed and a roof over my head. You take such good care of me and my family! While many people in the world don't have homes, You have given me a safe and cozy place to sleep. I am so blessed!",
    "Lord, thank You for the sun that shines during the day and the rain that waters all the plants. Thank You for the seasons and the weather. You control everything in nature with perfect wisdom. Your creation is amazing and beautiful!",
    "Papa God, thank You for my clothes, my shoes, and everything I need. You provide for me in so many ways I don't even notice. Help me to have a grateful heart that sees all Your blessings, big and small. You are an amazing Father!",
    "Jesus, thank You for loving me even when I make mistakes. Your grace is so big and so free! Thank You for never giving up on me and for always giving me another chance. I don't deserve Your love, but You give it anyway.",
    "Father, thank You for the Bible so I can read about You and learn Your ways. Thank You for preserving Your Word for thousands of years so I could have it today. Help me to treasure the Bible and read it often. It is a lamp to my feet!"
  ],
  sorry: [
    "Papa God, I am sorry for not listening to my parents today. Please forgive me for being stubborn and thinking I knew better. Help me to have a respectful heart and to obey quickly and cheerfully next time. Thank You for patient parents who love me anyway.",
    "Jesus, I am sorry I got angry and lost my temper today. Help me to have peace inside my heart even when things don't go my way. Teach me to take deep breaths, count to ten, and respond with kindness instead of anger. I want to be more like You.",
    "Father, forgive me for saying mean words that hurt someone's feelings. Please wash my mouth and heart clean. Help me to think before I speak and to only say things that build people up. Let my words be like honey, sweet and helpful.",
    "God, I am sorry I disobeyed and made a wrong choice. Help me to choose the right way next time, even when it's hard. Give me courage to do what's right even when no one is watching. I want to make You proud of me.",
    "Lord, forgive me for fighting with my siblings and friends. Help me to be a peacemaker who brings people together instead of pushing them apart. Teach me to use my words to solve problems and to be quick to say sorry when I'm wrong.",
    "Papa God, I am sorry for being selfish and not wanting to share. Help me to have a generous heart like Yours. Remind me that everything I have is a gift from You, and help me to hold my things loosely and share them freely with others.",
    "Jesus, thank You for forgiving me completely. Help me to forgive myself too and not keep feeling bad about my mistakes. Your blood covers all my sins! Help me to accept Your forgiveness and move forward with joy and freedom.",
    "Father, I am sorry I lied instead of telling the truth. Help me to always speak honestly, even when it's scary. Give me courage to be truthful and help me to trust that the truth is always better than a lie in the end."
  ],
  school: [
    "Papa God, help me to learn new things today! Open my mind to understand difficult concepts and remember what I study. Give me curiosity and a love for learning. Help me to see school as an exciting adventure where I get to discover more about Your amazing world.",
    "Jesus, help me to focus and listen carefully to my teacher today. Help me not to get distracted by my friends or daydream during class. Give me concentration and help me to make the most of my learning time. I want to do my very best!",
    "Father, give me a smart mind to solve problems, read well, and understand math. Thank You for the brain You gave me! Help me to use it well and to work hard even when the work is difficult. I know You gave me everything I need to succeed.",
    "God, thank You for my school, my teachers, and all my classmates. Bless each one of them today! Help us to get along, work together, and learn from each other. Make our classroom a happy and safe place where everyone can grow.",
    "Lord, help me to do my homework with a good attitude and not complain. Help me to work hard and do my best, not just rush through it. Teach me that hard work pays off and that discipline now will help me later in life.",
    "Papa God, help me when learning gets tricky and I feel like giving up. Remind me that I can do hard things with Your help! Give me perseverance to keep trying and confidence to believe in myself. You made me capable of great things!",
    "Jesus, give me wisdom and understanding that only comes from You. You are the source of all truth and knowledge! Help me to learn not just facts, but wisdom for life. Guide my thoughts and help me think clearly.",
    "Father, help me to be a good example at school by being kind, honest, and hardworking. Let my light shine so others can see Jesus in me. Help me to stand up for what's right even when it's not popular. I want to represent You well."
  ],
  love: [
    "Papa God, help me to love others just like You love me—big, unconditional, and never-ending. Teach me what real love looks like and help me to put others before myself. Fill me up with so much love that it overflows to everyone around me!",
    "Jesus, fill my heart with Your love today until it overflows to everyone I meet. Let people feel Your warmth and kindness through me. Help me to see others the way You see them—precious and valuable. Make me a channel of Your love!",
    "Father, help me to be patient and kind, not jealous or proud. Teach me that love is not about getting but about giving. Help me to celebrate when others succeed instead of feeling left out. Give me a heart that is truly happy for others.",
    "God, thank You that Your love never fails and is always there for me no matter what. Even on my worst days, Your love doesn't change! It is steady, strong, and forever. I am so secure in Your love. Thank You for loving me unconditionally!",
    "Lord, help me to love people who are hard to love. Give me Your eyes to see them and Your heart to care for them. Help me to be kind even when others are mean, and to respond with love even when it's difficult. Transform my heart!",
    "Papa God, show me how to serve others in love today. Help me to look for ways to be a helper and to put smiles on people's faces. Open my eyes to see needs around me and give me the courage and energy to meet them with joy.",
    "Jesus, thank You for loving me first, even before I knew You or loved You back. Your love found me when I was lost and brought me home. Help me to love others the same way—without waiting for them to earn it or deserve it.",
    "Father, let everything I do today be done in love—my words, my actions, my thoughts, and my attitudes. Help love to be my motivation in everything. When I am tempted to be selfish or unkind, remind me to choose love instead."
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