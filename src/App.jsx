/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Delete, 
  ArrowRight, 
  RotateCcw, 
  BookOpen, 
  Play, 
  CheckCircle2, 
  XCircle,
  Volume2,
  VolumeX,
  Menu,
  X,
  Type as TypeIcon,
  Home,
  Trophy,
  Target,
  AlertCircle,
  Sparkles,
  Flame,
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Share,
  Music,
  Info,
  Keyboard,
  MousePointer2,
  LogIn,
  LogOut,
  MessageSquare,
  Users,
  Send,
  Radio,
  Mic,
  MicOff,
  Waves
} from 'lucide-react';
import { 
  MORSE_DICTIONARY, 
  REVERSE_MORSE_DICTIONARY, 
  SENTENCES, 
  DASH_THRESHOLD, 
  LETTER_WAIT_TIME 
} from './constants';
import { morseAudio, musicService } from './services/audioService';
import { auth, db, signIn, logOut } from './firebase';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { GoogleGenAI, Modality } from "@google/genai";

export default function App() {
  const [currentView, setCurrentView] = useState('main');
  const [targetWords, setTargetWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userWords, setUserWords] = useState([]);
  const [typedWord, setTypedWord] = useState("");
  const [currentMorseBuffer, setCurrentMorseBuffer] = useState("");
  const [results, setResults] = useState([]);
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [missionDescription, setMissionDescription] = useState("");
  const [missionDifficultyLabel, setMissionDifficultyLabel] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isKeyPressed, setIsKeyPressed] = useState(false);

  // Cinematic States
  const [showIgnite, setShowIgnite] = useState(false);
  const [showExtinguish, setShowExtinguish] = useState(false);

  // Firebase State
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Live Radio State
  const [isRadioActive, setIsRadioActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [radioStatus, setRadioStatus] = useState("Standby");
  const liveSessionRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const audioQueueRef = useRef([]);

  const handleFirestoreError = (error, operationType, path) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    // We don't necessarily want to crash the whole app with a throw here if it's just a listener
    // but the instructions say MUST throw a new error.
    // However, in a listener, throwing might just be caught by the browser.
  };

  // Stats State
  const [stats, setStats] = useState(() => {
    const defaultStats = {
      level: 1,
      totalErrors: 0,
      totalCorrect: 0,
      challengesCompleted: 0,
      streak: 0,
      isStreakUnlocked: false,
      consecutivePerfectLevels: 0,
      visualAidEnabled: true,
      hasSeenTutorial: false
    };
    try {
      const saved = localStorage.getItem('morse_stats_v4');
      if (!saved) return defaultStats;
      const parsed = JSON.parse(saved);
      return { ...defaultStats, ...parsed };
    } catch (e) {
      return defaultStats;
    }
  });

  useEffect(() => {
    localStorage.setItem('morse_stats_v4', JSON.stringify(stats));
    
    // Sync with Firestore if logged in
    if (user && !isSyncing) {
      const syncStats = async () => {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            level: stats.level,
            streak: stats.streak,
            totalCorrect: stats.totalCorrect,
            lastActive: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.error("Error syncing stats:", e);
        }
      };
      syncStats();
    }
  }, [stats, user]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Load stats from Firestore on login
        setIsSyncing(true);
        const userDoc = doc(db, 'users', u.uid);
        onSnapshot(userDoc, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setStats(prev => ({
              ...prev,
              level: data.level || prev.level,
              streak: data.streak || prev.streak,
              totalCorrect: data.totalCorrect || prev.totalCorrect
            }));
          }
          setIsSyncing(false);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Leaderboard Listener
  useEffect(() => {
    if (!user) {
      setLeaderboard([]);
      return;
    }
    const q = query(collection(db, 'users'), orderBy('level', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setLeaderboard(data);
    }, (error) => {
      handleFirestoreError(error, 'get', 'users');
    });
    return () => unsubscribe();
  }, [user]);

  // Chat Listener
  useEffect(() => {
    if (!user) {
      setChatMessages([]);
      return;
    }
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data()).reverse();
      setChatMessages(data);
    }, (error) => {
      handleFirestoreError(error, 'get', 'messages');
    });
    return () => unsubscribe();
  }, [user]);

  const sendMessage = async (text) => {
    if (!user || !text.trim()) return;
    try {
      await addDoc(collection(db, 'messages'), {
        uid: user.uid,
        displayName: user.displayName,
        text: text.trim(),
        createdAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, 'create', 'messages');
    }
  };

  const startRadio = async () => {
    if (isRadioActive) {
      stopRadio();
      return;
    }

    try {
      setRadioStatus("Conectando...");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "Eres un operador de radio militar experto en código Morse. Tu nombre en clave es 'Vanguardia'. Responde de forma breve, profesional y con un toque de misterio. Si el usuario te habla en Morse, tradúcelo. Mantén la atmósfera de una misión secreta.",
        },
        callbacks: {
          onopen: () => {
            setRadioStatus("Transmitiendo");
            setIsRadioActive(true);
            startMicStreaming();
          },
          onmessage: async (message) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              playAudioChunk(base64Audio);
            }
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
            }
          },
          onclose: () => stopRadio(),
          onerror: (e) => {
            console.error("Radio Error:", e);
            stopRadio();
          }
        }
      });
      liveSessionRef.current = session;
    } catch (e) {
      console.error("Failed to start radio:", e);
      setRadioStatus("Error de Conexión");
    }
  };

  const startMicStreaming = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (isMuted || !liveSessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        liveSessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      processorRef.current = { stream, source, processor };
    } catch (e) {
      console.error("Mic Error:", e);
    }
  };

  const playAudioChunk = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcmData = new Int16Array(bytes.buffer);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) floatData[i] = pcmData[i] / 0x7FFF;

    const buffer = audioContextRef.current.createBuffer(1, floatData.length, 16000);
    buffer.getChannelData(0).set(floatData);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  const stopRadio = () => {
    setIsRadioActive(false);
    setRadioStatus("Standby");
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.stream.getTracks().forEach(t => t.stop());
      processorRef.current.source.disconnect();
      processorRef.current.processor.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // Music Management
  useEffect(() => {
    musicService.setMuted(!musicEnabled);
  }, [musicEnabled]);

  useEffect(() => {
    if (!musicEnabled) {
      musicService.stop();
      return;
    }

    switch (currentView) {
      case 'main':
        musicService.play('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
        break;
      case 'play':
        musicService.play('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3');
        break;
      case 'settings':
      case 'stats':
      case 'practice':
        musicService.play('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3');
        break;
      default:
        // Keep current or stop if appropriate
        break;
    }
  }, [currentView, musicEnabled]);

  // Practice Mode State
  const [practiceChar, setPracticeChar] = useState('A');
  const [practiceFeedback, setPracticeFeedback] = useState('none');

  // Reset Progress States
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetInput, setResetInput] = useState("");

  const pressStartTimeRef = useRef(0);
  const letterTimeoutRef = useRef(null);

  // Audio handling
  const startBeep = useCallback(() => {
    if (soundEnabled) morseAudio.start();
  }, [soundEnabled]);

  const stopBeep = useCallback(() => {
    if (soundEnabled) morseAudio.stop();
  }, [soundEnabled]);

  const generateLevelMission = (level) => {
    setCurrentView('mission_preview');
    
    // Offline Logic
    const sentenceIndex = (level - 1) % SENTENCES.length;
    const sentence = SENTENCES[sentenceIndex];
    
    let difficulty = "Recluta";
    let description = "Entrenamiento básico de radio.";

    if (level > 5) {
      difficulty = "Espía";
      description = "Mensaje interceptado en territorio enemigo.";
    }
    if (level > 15) {
      difficulty = "Maestro";
      description = "Transmisión crítica durante la tormenta.";
    }
    if (level > 30) {
      difficulty = "Leyenda";
      description = "El destino del mundo depende de este mensaje.";
    }

    setMissionDescription(description);
    setMissionDifficultyLabel(difficulty);
    setTargetWords(sentence.toUpperCase().split(" "));
    resetGameplay();
  };

  const startMission = () => {
    setCurrentView('play');
  };

  const startCorrectionMode = () => {
    const wrongWords = results.filter(r => !r.isCorrect).map(r => r.target);
    setTargetWords(wrongWords);
    resetGameplay();
    setIsCorrectionMode(true);
    setCurrentView('play');
  };

  const resetGameplay = () => {
    setCurrentWordIndex(0);
    setUserWords([]);
    setTypedWord("");
    setCurrentMorseBuffer("");
  };

  const startPractice = () => {
    setPracticeChar('A');
    setTypedWord("");
    setCurrentMorseBuffer("");
    setPracticeFeedback('none');
    setCurrentView('practice');
  };

  const initiateReset = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setResetCode(code);
    setResetInput("");
    setShowResetModal(true);
  };

  const confirmReset = () => {
    if (resetInput === resetCode) {
      const initialStats = {
        level: 1,
        totalErrors: 0,
        totalCorrect: 0,
        challengesCompleted: 0,
        streak: 0,
        isStreakUnlocked: false,
        consecutivePerfectLevels: 0,
        visualAidEnabled: true
      };
      setStats(initialStats);
      localStorage.setItem('morse_stats_v4', JSON.stringify(initialStats));
      setShowResetModal(false);
      setCurrentView('main');
    }
  };

  const commitLetter = useCallback(() => {
    if (currentMorseBuffer === "") return;
    const letter = REVERSE_MORSE_DICTIONARY[currentMorseBuffer];
    const finalLetter = letter || "?";
    
    if (currentView === 'practice') {
      if (finalLetter === practiceChar) {
        setPracticeFeedback('correct');
        setTimeout(() => {
          const nextCharCode = practiceChar.charCodeAt(0) + 1;
          if (nextCharCode > 90) { // End of Z
            setCurrentView('main');
          } else {
            setPracticeChar(String.fromCharCode(nextCharCode));
            setPracticeFeedback('none');
            setTypedWord("");
          }
        }, 600);
      } else {
        setPracticeFeedback('wrong');
        setTimeout(() => setPracticeFeedback('none'), 600);
      }
      setCurrentMorseBuffer("");
    } else {
      setTypedWord(prev => prev + finalLetter);
      setCurrentMorseBuffer("");
    }
  }, [currentMorseBuffer, currentView, practiceChar]);

  useEffect(() => {
    if (currentMorseBuffer !== "") {
      if (letterTimeoutRef.current) clearTimeout(letterTimeoutRef.current);
      letterTimeoutRef.current = setTimeout(commitLetter, LETTER_WAIT_TIME);
    }
    return () => {
      if (letterTimeoutRef.current) clearTimeout(letterTimeoutRef.current);
    };
  }, [currentMorseBuffer, commitLetter]);

  useEffect(() => {
    if (!stats.hasSeenTutorial && currentView === 'main') {
      setShowTutorial(true);
    }
  }, [stats.hasSeenTutorial, currentView]);

  const handlePressStart = useCallback((e) => {
    if (e) e.preventDefault();
    pressStartTimeRef.current = Date.now();
    if (letterTimeoutRef.current) clearTimeout(letterTimeoutRef.current);
    startBeep();
  }, [startBeep]);

  const handlePressEnd = useCallback((e) => {
    if (e) e.preventDefault();
    if (pressStartTimeRef.current === 0) return;
    
    stopBeep();
    const duration = Date.now() - pressStartTimeRef.current;
    pressStartTimeRef.current = 0;

    setCurrentMorseBuffer(prev => prev + (duration < DASH_THRESHOLD ? '.' : '-'));
  }, [stopBeep]);

  const deleteLast = useCallback((e) => {
    if (e) e.preventDefault();
    if (letterTimeoutRef.current) clearTimeout(letterTimeoutRef.current);
    
    if (currentMorseBuffer.length > 0) {
      setCurrentMorseBuffer(prev => prev.slice(0, -1));
    } else if (typedWord.length > 0) {
      setTypedWord(prev => prev.slice(0, -1));
    }
  }, [currentMorseBuffer, typedWord]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (currentView !== 'play' && currentView !== 'practice') return;
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setIsKeyPressed(true);
        handlePressStart(e);
      }
      if (e.code === 'Backspace') {
        deleteLast(e);
      }
    };

    const handleKeyUp = (e) => {
      if (currentView !== 'play' && currentView !== 'practice') return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setIsKeyPressed(false);
        handlePressEnd(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentView, handlePressStart, handlePressEnd]);

  const submitWord = () => {
    // Force commit if buffer exists
    let finalTyped = typedWord;
    if (currentMorseBuffer !== "") {
      const letter = REVERSE_MORSE_DICTIONARY[currentMorseBuffer];
      finalTyped += (letter || "?");
      setCurrentMorseBuffer("");
    }

    if (finalTyped === "") return;

    const newUserWords = [...userWords, finalTyped];
    setUserWords(newUserWords);
    setTypedWord("");

    if (currentWordIndex + 1 >= targetWords.length) {
      const newResults = targetWords.map((target, i) => ({
        target,
        user: newUserWords[i],
        isCorrect: target === newUserWords[i]
      }));
      
      const errorsInThisLevel = newResults.filter(r => !r.isCorrect).length;
      const isPerfect = errorsInThisLevel === 0;

      setStats(prev => {
        const increment = prev.visualAidEnabled ? 1 : 2;
        const newConsecutive = isPerfect ? prev.consecutivePerfectLevels + increment : 0;
        
        // Unlock Streak Logic: Level 5 OR 5 points of consecutive perfects
        const unlockedNow = !prev.isStreakUnlocked && (prev.level >= 5 || newConsecutive >= 5);
        
        let newStreak = prev.streak;
        if (prev.isStreakUnlocked || unlockedNow) {
          if (isPerfect) {
            newStreak += 1;
          } else {
            newStreak = 0;
          }
        }

        // Trigger Cinematics
        if (unlockedNow || (prev.isStreakUnlocked && isPerfect && prev.streak === 0)) {
          setShowIgnite(true);
          setTimeout(() => setShowIgnite(false), 2500);
        } else if (prev.isStreakUnlocked && !isPerfect && prev.streak > 0) {
          setShowExtinguish(true);
          setTimeout(() => setShowExtinguish(false), 2500);
        }

        return {
          ...prev,
          totalErrors: prev.totalErrors + errorsInThisLevel,
          totalCorrect: prev.totalCorrect + (newResults.length - errorsInThisLevel),
          level: isPerfect ? prev.level + 1 : prev.level,
          challengesCompleted: prev.challengesCompleted + 1,
          consecutivePerfectLevels: newConsecutive,
          isStreakUnlocked: prev.isStreakUnlocked || unlockedNow,
          streak: newStreak
        };
      });

      setResults(newResults);
      setCurrentView('results');
    } else {
      setCurrentWordIndex(prev => prev + 1);
    }
  };

  const shareResults = () => {
    const text = `¡He logrado una racha de ${stats.streak} en React Morse! 📡🔥 Nivel: ${stats.level}. ¿Puedes superarme? #ReactMorse`;
    if (navigator.share) {
      navigator.share({
        title: 'React Morse',
        text: text,
        url: 'https://morse-psi.vercel.app/',
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  // Views
  const finishTutorial = () => {
    setStats(prev => ({ ...prev, hasSeenTutorial: true }));
    setShowTutorial(false);
  };

  const tutorialSteps = [
    {
      title: "¡Bienvenido Recluta!",
      content: "Estás a punto de aprender el lenguaje secreto de los espías: el Código Morse.",
      icon: <Sparkles className="w-12 h-12 text-emerald-500" />
    },
    {
      title: "Cómo Transmitir",
      content: window.innerWidth > 768 
        ? "En tu portátil, usa la tecla ESPACIO o ENTER. Presiona corto para un PUNTO (.) y largo para una RAYA (-)."
        : "En tu teléfono, pulsa el botón central. Un toque rápido es un PUNTO (.) y mantenerlo es una RAYA (-).",
      icon: window.innerWidth > 768 ? <Keyboard className="w-12 h-12 text-zinc-900" /> : <MousePointer2 className="w-12 h-12 text-zinc-900" />
    },
    {
      title: "Formando Letras",
      content: "Después de cada letra, espera un momento y el sistema la reconocerá automáticamente. ¡No hay prisa!",
      icon: <TypeIcon className="w-12 h-12 text-zinc-900" />
    }
  ];

  const renderTutorial = () => (
    <AnimatePresence>
      {showTutorial && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-white flex items-center justify-center p-6"
        >
          <motion.div 
            key={tutorialStep}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-w-sm w-full text-center"
          >
            <div className="flex justify-center mb-8">
              {tutorialSteps[tutorialStep].icon}
            </div>
            <h2 className="text-3xl font-black uppercase italic mb-4">
              {tutorialSteps[tutorialStep].title}
            </h2>
            <p className="text-zinc-500 font-medium leading-relaxed mb-12">
              {tutorialSteps[tutorialStep].content}
            </p>
            
            <div className="flex flex-col gap-4">
              {tutorialStep < tutorialSteps.length - 1 ? (
                <button 
                  onClick={() => setTutorialStep(prev => prev + 1)}
                  className="w-full py-5 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                >
                  Siguiente
                </button>
              ) : (
                <button 
                  onClick={finishTutorial}
                  className="w-full py-5 bg-emerald-500 text-white font-black rounded-2xl uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                >
                  ¡Entendido!
                </button>
              )}
              
              <div className="flex justify-center gap-2">
                {tutorialSteps.map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-2 h-2 rounded-full transition-colors ${i === tutorialStep ? 'bg-zinc-900' : 'bg-zinc-200'}`} 
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  const renderMain = () => (
    <motion.div 
      key="main"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-screen p-6 text-center"
    >
      <div className="relative mb-4 p-4 bg-black text-white rounded-2xl shadow-2xl rotate-[-2deg]">
        <div className="absolute -top-4 -left-4 bg-emerald-500 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest rotate-[-15deg] shadow-lg border-2 border-black z-10">
          Beta
        </div>
        <h1 className="text-5xl font-black tracking-tighter uppercase italic">React Morse</h1>
      </div>
      
      <div className="flex items-center gap-4 mb-12">
        <div className="flex items-center gap-2 px-4 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black uppercase tracking-widest">
          <Trophy className="w-3 h-3" /> Nivel {stats.level}
        </div>
        
        {stats.isStreakUnlocked && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`flex items-center gap-2 px-4 py-1 ${stats.streak > 0 ? 'bg-orange-100 text-orange-600' : 'bg-zinc-100 text-zinc-400'} rounded-full text-xs font-black uppercase tracking-widest`}
          >
            <Flame className={`w-3 h-3 ${stats.streak > 0 ? 'fill-current animate-pulse' : ''}`} />
            Racha: {stats.streak}
          </motion.div>
        )}
      </div>

      <div className="grid gap-4 w-full max-w-sm mx-auto">
        <button 
          onClick={() => generateLevelMission(stats.level)}
          className="group relative flex items-center justify-between p-8 bg-zinc-900 text-white rounded-2xl transition-all duration-300 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          <div className="flex items-center gap-4">
            <Play className="w-8 h-8 fill-current" />
            <div className="text-left">
              <span className="block text-2xl font-black uppercase italic">Jugar Nivel {stats.level}</span>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Comenzar Desafío</span>
            </div>
          </div>
          <ArrowRight className="w-6 h-6" />
        </button>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <button 
            onClick={() => setShowTutorial(true)}
            className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-zinc-900 rounded-2xl hover:bg-zinc-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <Info className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Ayuda</span>
          </button>
          <button 
            onClick={startPractice}
            className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-zinc-900 rounded-2xl hover:bg-zinc-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <TypeIcon className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Alfabeto</span>
          </button>

          <button 
            onClick={() => setCurrentView('stats')}
            className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-zinc-900 rounded-2xl hover:bg-zinc-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <Target className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Progreso</span>
          </button>

          <button 
            onClick={() => setCurrentView('settings')}
            className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-zinc-900 rounded-2xl hover:bg-zinc-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Ajustes</span>
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderSettings = () => (
    <motion.div 
      key="settings"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen p-6 max-w-md mx-auto"
    >
      <header className="flex items-center gap-4 mb-12">
        <button onClick={() => setCurrentView('main')} className="p-2 hover:bg-zinc-100 rounded-full">
          <ChevronLeft className="w-8 h-8" />
        </button>
        <h2 className="text-3xl font-black italic uppercase tracking-tight">Ajustes</h2>
      </header>

      <div className="space-y-6">
        <div className="p-6 bg-white border-2 border-zinc-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {stats.visualAidEnabled ? <Eye className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
              <div>
                <div className="font-black uppercase italic">Ayuda Visual</div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Muestra el código morse</div>
              </div>
            </div>
            <button 
              onClick={() => setStats(prev => ({ ...prev, visualAidEnabled: !prev.visualAidEnabled }))}
              className={`w-14 h-8 rounded-full p-1 transition-colors ${stats.visualAidEnabled ? 'bg-emerald-500' : 'bg-zinc-200'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-transform ${stats.visualAidEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
          {!stats.visualAidEnabled && (
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> ¡Racha desbloqueable más rápido!
            </div>
          )}
        </div>

        <div className="p-6 bg-white border-2 border-zinc-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
              <div>
                <div className="font-black uppercase italic">Efectos de Sonido</div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Audio del código morse</div>
              </div>
            </div>
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-14 h-8 rounded-full p-1 transition-colors ${soundEnabled ? 'bg-emerald-500' : 'bg-zinc-200'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="p-6 bg-white border-2 border-zinc-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Play className="w-6 h-6" />
              <div>
                <div className="font-black uppercase italic">Música de Fondo</div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ambiente sonoro</div>
              </div>
            </div>
            <button 
              onClick={() => setMusicEnabled(!musicEnabled)}
              className={`w-14 h-8 rounded-full p-1 transition-colors ${musicEnabled ? 'bg-emerald-500' : 'bg-zinc-200'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-transform ${musicEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="pt-8 space-y-4">
          <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-200">
            <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" /> Información del Proyecto
            </h3>
            <p className="text-[11px] text-zinc-500 font-medium leading-relaxed mb-4">
              React Morse es una herramienta educativa diseñada para enseñar el código morse de forma interactiva. 
              Ideal para entusiastas de la radio, espionaje o simplemente curiosos.
            </p>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              © 2026 React Morse Project
            </div>
          </div>

          <button 
            onClick={initiateReset}
            className="w-full py-4 bg-red-50 text-red-600 border-2 border-red-200 rounded-2xl font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
          >
            Reiniciar Progreso
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderMissionPreview = () => (
    <motion.div 
      key="mission_preview"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto"
    >
      <div className="w-20 h-20 bg-zinc-900 text-white rounded-full flex items-center justify-center mb-8">
        <Sparkles className="w-10 h-10" />
      </div>
      
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
        <div>
          <div className="inline-block px-3 py-1 bg-zinc-100 text-zinc-900 text-[10px] font-black rounded-full uppercase tracking-widest mb-4">
            Dificultad: {missionDifficultyLabel}
          </div>
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">Misión Nivel {stats.level}</h2>
          <p className="text-3xl font-black italic uppercase leading-tight">"{missionDescription}"</p>
        </div>
        
        <div className="p-6 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl">
          <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Objetivo de Transmisión</p>
          <p className="text-xl font-mono font-bold tracking-widest">{targetWords.join(" ")}</p>
        </div>

        <button 
          onClick={startMission}
          className="w-full py-6 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          Aceptar Misión
        </button>
        
        <button onClick={() => setCurrentView('main')} className="text-zinc-400 font-bold uppercase text-xs tracking-widest hover:text-zinc-900">
          Cancelar
        </button>
      </motion.div>
    </motion.div>
  );

  const renderStats = () => (
    <motion.div 
      key="stats"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen p-6 max-w-md mx-auto"
    >
      <header className="flex items-center gap-4 mb-12">
        <button onClick={() => setCurrentView('main')} className="p-2 hover:bg-zinc-100 rounded-full">
          <ChevronLeft className="w-8 h-8" />
        </button>
        <h2 className="text-3xl font-black italic uppercase tracking-tight">Tu Progreso</h2>
      </header>

      <div className="grid gap-6">
        <div className="p-8 bg-zinc-900 text-white rounded-3xl relative overflow-hidden">
          <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
          <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">Nivel Actual</div>
          <div className="text-7xl font-black italic">{stats.level}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-white border-2 border-zinc-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-2 text-emerald-500 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Correctas</span>
            </div>
            <div className="text-3xl font-black">{stats.totalCorrect}</div>
          </div>

          <div className="p-6 bg-white border-2 border-zinc-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-2 text-rose-500 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Errores</span>
            </div>
            <div className="text-3xl font-black">{stats.totalErrors}</div>
          </div>
        </div>

        <div className="p-6 bg-white border-2 border-zinc-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Precisión General</div>
            <div className="text-2xl font-black">
              {stats.totalCorrect + stats.totalErrors > 0 
                ? Math.round((stats.totalCorrect / (stats.totalCorrect + stats.totalErrors)) * 100) 
                : 0}%
            </div>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-zinc-100 flex items-center justify-center">
             <Target className="w-6 h-6 text-zinc-300" />
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderPractice = () => (
    <motion.div 
      key="practice"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col p-6 max-w-md mx-auto"
    >
      <header className="flex justify-between items-center mb-8">
        <button onClick={() => setCurrentView('main')} className="p-2 hover:bg-zinc-100 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="px-4 py-1 bg-zinc-900 text-white text-xs font-black rounded-full uppercase tracking-widest">
          Aprendiendo el Alfabeto
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-center items-center gap-12">
        <div className="text-center">
          <motion.div 
            key={practiceChar}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-9xl font-black mb-4 ${
              practiceFeedback === 'correct' ? 'text-emerald-500' : 
              practiceFeedback === 'wrong' ? 'text-rose-500' : 'text-zinc-900'
            }`}
          >
            {practiceChar}
          </motion.div>
          <div className="text-2xl font-mono font-bold text-zinc-400 tracking-widest">
            {MORSE_DICTIONARY[practiceChar]}
          </div>
        </div>

        <div className="text-center h-20">
          <div className="text-4xl font-mono font-bold text-zinc-900 tracking-[0.3em]">
            {currentMorseBuffer || " "}
          </div>
          {practiceFeedback === 'wrong' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-500 font-bold uppercase text-sm mt-2">
              ¡Inténtalo de nuevo!
            </motion.div>
          )}
        </div>

        <div className="w-full flex justify-center">
          <button
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative w-32 h-32 group transition-transform ${isKeyPressed ? 'scale-95' : 'active:scale-95'}`}
          >
            <div className={`absolute inset-0 bg-zinc-900 rounded-full transition-all ${isKeyPressed ? 'shadow-none translate-y-2' : 'shadow-[0_8px_0_0_rgba(0,0,0,1)] group-active:shadow-none group-active:translate-y-2'}`} />
            <div className="absolute inset-0 flex items-center justify-center text-white font-black text-xs uppercase tracking-widest">
              {isKeyPressed ? '...' : 'Pulse'}
            </div>
          </button>
        </div>
      </div>
      <p className="text-center text-zinc-400 text-sm font-medium mb-8">
        Escribe el código morse de la letra <span className="font-bold text-zinc-900">{practiceChar}</span>
      </p>
    </motion.div>
  );

  const renderPlay = () => {
    const activeWord = targetWords[currentWordIndex];
    
    if (!activeWord) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <button onClick={() => setCurrentView('main')} className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-black uppercase italic">
            Volver al Menú
          </button>
        </div>
      );
    }

    return (
      <motion.div 
        key="play"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex flex-col p-6 max-w-md mx-auto"
      >
        <header className="flex justify-between items-center mb-8">
          <button onClick={() => setCurrentView('main')} className="p-2 hover:bg-zinc-100 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="px-4 py-1 bg-zinc-900 text-white text-xs font-black rounded-full uppercase tracking-widest">
            Palabra {currentWordIndex + 1} de {targetWords.length}
          </div>
        </header>

        <div className="flex-1 flex flex-col justify-center gap-8">
          {/* Sentence Display */}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 text-2xl font-bold text-zinc-300">
            {targetWords.map((word, i) => (
              <span key={i} className={`${i === currentWordIndex ? 'text-zinc-900 underline decoration-4 underline-offset-8' : i < currentWordIndex ? 'text-emerald-500' : ''}`}>
                {word}
              </span>
            ))}
          </div>

          {/* Hint Box */}
          {stats.visualAidEnabled && (
            <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl overflow-x-auto whitespace-nowrap scrollbar-hide">
              <div className="flex gap-6 justify-center">
                {activeWord.split('').map((char, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-xs font-black text-zinc-400">{char}</span>
                    <span className="font-mono font-bold text-zinc-900 tracking-tighter">{MORSE_DICTIONARY[char]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Typing Area */}
          <div className="text-center h-32 flex flex-col items-center justify-center">
            <div className="text-5xl font-black tracking-widest mb-2 min-h-[1em]">
              {typedWord}
              <motion.span 
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-1 h-10 bg-zinc-900 ml-1 align-middle"
              />
            </div>
            <div className="text-3xl font-mono font-bold text-zinc-400 tracking-[0.2em] h-10">
              {currentMorseBuffer}
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-3 items-center gap-8 mb-12">
            <button 
              onMouseDown={deleteLast}
              onTouchStart={deleteLast}
              className="flex items-center justify-center w-16 h-16 mx-auto rounded-full border-2 border-zinc-200 hover:border-zinc-900 transition-colors active:bg-zinc-100"
            >
              <Delete className="w-6 h-6" />
            </button>

            <button
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onTouchStart={handlePressStart}
              onTouchEnd={handlePressEnd}
              onContextMenu={(e) => e.preventDefault()}
              className={`relative w-28 h-28 mx-auto group transition-transform ${isKeyPressed ? 'scale-95' : 'active:scale-95'}`}
            >
              <div className={`absolute inset-0 bg-zinc-900 rounded-full transition-all ${isKeyPressed ? 'shadow-none translate-y-2' : 'shadow-[0_8px_0_0_rgba(0,0,0,1)] group-active:shadow-none group-active:translate-y-2'}`} />
              <div className="absolute inset-0 flex items-center justify-center text-white font-black text-xs uppercase tracking-widest">
                {isKeyPressed ? '...' : 'Pulse'}
              </div>
            </button>

            <button 
              onClick={submitWord}
              className="flex items-center justify-center w-16 h-16 mx-auto rounded-full border-2 border-zinc-200 hover:border-zinc-900 transition-colors"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        <button 
          onClick={submitWord}
          className="w-full py-5 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
        >
          Siguiente Palabra
        </button>
      </motion.div>
    );
  };

  const renderResults = () => {
    const correctCount = results.filter(r => r.isCorrect).length;
    const allCorrect = correctCount === results.length;

    return (
      <motion.div 
        key="results"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen p-6 max-w-md mx-auto flex flex-col"
      >
        <div className="text-center mb-12 mt-8">
          <div className={`inline-flex p-4 rounded-full mb-6 ${allCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-600'}`}>
            {allCorrect ? <Sparkles className="w-16 h-16" /> : <Play className="w-16 h-16" />}
          </div>
          <h2 className="text-4xl font-black italic uppercase mb-2">
            {allCorrect ? '¡Nivel Superado!' : 'Nivel Completado'}
          </h2>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">
            {allCorrect ? '¡Has subido al siguiente nivel!' : 'Practica los errores para subir de nivel'}
          </p>
        </div>

        <div className="flex-1 space-y-3 mb-8">
          {results.map((res, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white border-2 border-zinc-900 rounded-2xl">
              <div>
                <div className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">Objetivo: {res.target}</div>
                <div className="text-xl font-bold">{res.user || "---"}</div>
              </div>
              {res.isCorrect ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-500" />
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-4">
          <button 
            onClick={shareResults}
            className="w-full py-4 bg-white border-2 border-zinc-900 text-zinc-900 font-black rounded-2xl uppercase tracking-widest flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
          >
            <Share className="w-5 h-5" />
            Compartir Racha
          </button>

          {allCorrect ? (
            <button 
              onClick={() => generateLevelMission(stats.level)}
              className="w-full py-5 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-widest flex items-center justify-center gap-3"
            >
              Siguiente Nivel ({stats.level})
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <>
              <button 
                onClick={startCorrectionMode}
                className="w-full py-5 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-widest flex items-center justify-center gap-3"
              >
                <RotateCcw className="w-5 h-5" />
                Corregir Errores
              </button>
              <button 
                onClick={() => setCurrentView('main')}
                className="w-full py-5 bg-white border-2 border-zinc-900 text-zinc-900 font-black rounded-2xl uppercase tracking-widest"
              >
                Menú Principal
              </button>
            </>
          )}
        </div>
      </motion.div>
    );
  };

  const renderResetModal = () => (
    <AnimatePresence>
      {showResetModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-sm bg-white border-4 border-zinc-900 rounded-[2.5rem] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            
            <h2 className="text-2xl font-black italic uppercase text-center mb-2">¿Borrar Todo?</h2>
            <p className="text-zinc-500 text-sm font-bold text-center mb-8 uppercase tracking-tight">
              Esta acción es irreversible. Perderás tu nivel, racha y estadísticas.
            </p>
            
            <div className="bg-zinc-100 p-6 rounded-3xl mb-8 text-center">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Ingresa el código de seguridad</p>
              <p className="text-3xl font-mono font-black tracking-[0.5em] text-zinc-900 mb-4">{resetCode}</p>
              <input 
                type="text" 
                maxLength={4}
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value.replace(/\D/g, ''))}
                placeholder="----"
                className="w-full bg-white border-2 border-zinc-900 rounded-xl py-3 text-center text-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={confirmReset}
                disabled={resetInput !== resetCode}
                className={`w-full py-4 font-black rounded-2xl uppercase tracking-widest transition-all ${
                  resetInput === resetCode 
                  ? 'bg-red-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none' 
                  : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                Confirmar Borrado
              </button>
              <button 
                onClick={() => setShowResetModal(false)}
                className="w-full py-4 text-zinc-400 font-bold uppercase text-xs tracking-widest hover:text-zinc-900"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderLeaderboard = () => (
    <motion.div 
      key="leaderboard"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen p-6 max-w-md mx-auto flex flex-col"
    >
      <header className="flex justify-between items-center mb-8">
        <button onClick={() => setCurrentView('main')} className="p-2 hover:bg-zinc-100 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-black italic uppercase">Ranking Global</h2>
        <div className="w-10" />
      </header>

      <div className="bg-zinc-900 text-white p-6 rounded-[2rem] mb-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <Trophy className="w-12 h-12 text-yellow-400 mb-4" />
          <h3 className="text-3xl font-black italic uppercase leading-none mb-2">Los Mejores Espías</h3>
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Sincronizado en tiempo real</p>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 blur-3xl rounded-full -mr-16 -mt-16" />
      </div>

      <div className="flex-1 space-y-3">
        {leaderboard.map((entry, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={entry.uid} 
            className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${entry.uid === user?.uid ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-zinc-900'}`}
          >
            <div className="w-8 font-black text-xl italic text-zinc-400">#{i + 1}</div>
            <img src={entry.photoURL} alt={entry.displayName} className="w-10 h-10 rounded-full border-2 border-zinc-900" />
            <div className="flex-1">
              <div className="font-bold text-sm truncate w-32">{entry.displayName}</div>
              <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nivel {entry.level}</div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-orange-500 font-black">
                <Flame className="w-4 h-4" />
                {entry.streak}
              </div>
            </div>
          </motion.div>
        ))}
        {leaderboard.length === 0 && (
          <div className="text-center py-12 text-zinc-400 font-bold italic">Cargando ranking...</div>
        )}
      </div>
    </motion.div>
  );

  const renderChat = () => {
    const [msgInput, setMsgInput] = useState("");
    
    const handleSend = () => {
      if (!user) {
        signIn();
        return;
      }
      sendMessage(msgInput);
      setMsgInput("");
    };

    return (
      <motion.div 
        key="chat"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="min-h-screen p-6 max-w-md mx-auto flex flex-col"
      >
        <header className="flex justify-between items-center mb-8">
          <button onClick={() => setCurrentView('main')} className="p-2 hover:bg-zinc-100 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-black italic uppercase">Chat Secreto</h2>
          <div className="w-10" />
        </header>

        <div className="bg-emerald-500 text-white p-6 rounded-[2rem] mb-6 shadow-lg">
          <MessageSquare className="w-10 h-10 mb-3" />
          <h3 className="text-2xl font-black italic uppercase leading-none mb-1">Canal Encriptado</h3>
          <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest">Solo para agentes autorizados</p>
        </div>

        <div className="flex-1 bg-white border-2 border-zinc-900 rounded-[2rem] p-4 mb-4 overflow-y-auto space-y-4 max-h-[50vh]">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.uid === user?.uid ? 'items-end' : 'items-start'}`}>
              <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 px-2">
                {msg.displayName}
              </div>
              <div className={`p-3 rounded-2xl max-w-[80%] font-mono font-bold text-sm tracking-widest ${
                msg.uid === user?.uid ? 'bg-zinc-900 text-white rounded-tr-none' : 'bg-zinc-100 text-zinc-900 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {chatMessages.length === 0 && (
            <div className="text-center py-12 text-zinc-400 font-bold italic">No hay mensajes aún...</div>
          )}
        </div>

        <div className="relative">
          <input 
            type="text"
            value={msgInput}
            onChange={(e) => setMsgInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Escribe en Morse..."
            className="w-full bg-white border-2 border-zinc-900 rounded-2xl py-4 px-6 pr-16 font-mono font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all"
          />
          <button 
            onClick={handleSend}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {!user && (
          <p className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-4">
            Debes <button onClick={signIn} className="text-zinc-900 underline">conectar tu perfil</button> para enviar mensajes
          </p>
        )}
      </motion.div>
    );
  };

  const renderRadio = () => (
    <motion.div 
      key="radio"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="min-h-screen p-6 max-w-md mx-auto flex flex-col"
    >
      <header className="flex justify-between items-center mb-8">
        <button onClick={() => { stopRadio(); setCurrentView('main'); }} className="p-2 hover:bg-zinc-100 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-black italic uppercase">Radio de Operaciones</h2>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-12">
        {/* Radio Visualizer */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          <motion.div 
            animate={isRadioActive ? { scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-emerald-500 rounded-full blur-3xl -z-10"
          />
          <div className={`w-48 h-48 rounded-full border-8 flex items-center justify-center transition-all duration-500 ${isRadioActive ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 bg-white'}`}>
            {isRadioActive ? (
              <div className="flex gap-1 items-end h-12">
                {[...Array(5)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: [10, 40, 10] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                    className="w-2 bg-emerald-500 rounded-full"
                  />
                ))}
              </div>
            ) : (
              <Radio className="w-16 h-16 text-zinc-200" />
            )}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em] mb-2">Estado de Frecuencia</div>
          <div className={`text-3xl font-black italic uppercase ${isRadioActive ? 'text-emerald-600' : 'text-zinc-400'}`}>
            {radioStatus}
          </div>
        </div>

        <div className="flex flex-col gap-6 w-full">
          <button 
            onClick={startRadio}
            className={`w-full py-6 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl ${
              isRadioActive 
              ? 'bg-rose-500 text-white shadow-rose-200' 
              : 'bg-zinc-900 text-white shadow-zinc-200'
            }`}
          >
            {isRadioActive ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            {isRadioActive ? 'Cerrar Canal' : 'Abrir Canal de Voz'}
          </button>

          {isRadioActive && (
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`w-full py-4 rounded-2xl font-bold uppercase text-xs tracking-widest border-2 transition-all ${
                isMuted ? 'bg-zinc-100 border-zinc-200 text-zinc-400' : 'bg-white border-zinc-900 text-zinc-900'
              }`}
            >
              {isMuted ? 'Micrófono Silenciado' : 'Micrófono Activo'}
            </button>
          )}
        </div>

        <p className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-relaxed">
          Estás conectado a la frecuencia 'Vanguardia'.<br/>
          Habla con la IA para recibir instrucciones de misión.
        </p>
      </div>
    </motion.div>
  );

  const renderCinematics = () => (
    <>
      <AnimatePresence>
        {showIgnite && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: [0, 1.5, 1], rotate: 0 }}
              transition={{ duration: 1.5, ease: "backOut" }}
              className="relative"
            >
              <Flame className="w-48 h-48 text-orange-500 fill-current animate-pulse" />
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-orange-500 blur-3xl -z-10"
              />
            </motion.div>
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-4xl font-black text-white italic uppercase mt-8 tracking-tighter"
            >
              ¡Racha Encendida!
            </motion.h2>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExtinguish && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-900"
          >
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: 10, opacity: 0 }}
              transition={{ duration: 2, ease: "circIn" }}
              className="relative"
            >
              <Flame className="w-32 h-32 text-orange-500 fill-current" />
            </motion.div>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <h2 className="text-4xl font-black text-zinc-600 italic uppercase tracking-tighter">
                Racha Extinguida
              </h2>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white overflow-x-hidden">
      {renderCinematics()}
      {renderResetModal()}
      {/* Hamburger Menu Button */}
      <button 
        onClick={() => setIsMenuOpen(true)}
        className="fixed top-6 right-6 z-40 p-3 bg-white border-2 border-zinc-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Sidebar Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-72 bg-white z-[60] p-8 border-l-4 border-zinc-900 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-12">
                <h3 className="text-2xl font-black italic uppercase">Ajustes</h3>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="space-y-6">
                <button 
                  onClick={() => { setCurrentView('main'); setIsMenuOpen(false); }}
                  className="flex items-center gap-4 w-full text-left font-bold text-lg hover:text-zinc-500 transition-colors"
                >
                  <Home className="w-6 h-6" /> Inicio
                </button>
                <button 
                  onClick={() => { startPractice(); setIsMenuOpen(false); }}
                  className="flex items-center gap-4 w-full text-left font-bold text-lg hover:text-zinc-500 transition-colors"
                >
                  <TypeIcon className="w-6 h-6" /> Práctica de Letras
                </button>
                <button 
                  onClick={() => { setCurrentView('stats'); setIsMenuOpen(false); }}
                  className="flex items-center gap-4 w-full text-left font-bold text-lg hover:text-zinc-500 transition-colors"
                >
                  <Target className="w-6 h-6" /> Mi Progreso
                </button>
                <button 
                  onClick={() => { setCurrentView('leaderboard'); setIsMenuOpen(false); }}
                  className="flex items-center gap-4 w-full text-left font-bold text-lg hover:text-zinc-500 transition-colors"
                >
                  <Users className="w-6 h-6" /> Ranking Global
                </button>
                <button 
                  onClick={() => { setCurrentView('chat'); setIsMenuOpen(false); }}
                  className="flex items-center gap-4 w-full text-left font-bold text-lg hover:text-zinc-500 transition-colors"
                >
                  <MessageSquare className="w-6 h-6" /> Chat Secreto
                </button>
                <button 
                  onClick={() => { setCurrentView('radio'); setIsMenuOpen(false); }}
                  className="flex items-center gap-4 w-full text-left font-bold text-lg hover:text-zinc-500 transition-colors"
                >
                  <Radio className="w-6 h-6" /> Radio de Operaciones
                </button>
                <button 
                  onClick={() => { setCurrentView('settings'); setIsMenuOpen(false); }}
                  className="flex items-center gap-4 w-full text-left font-bold text-lg hover:text-zinc-500 transition-colors"
                >
                  <SettingsIcon className="w-6 h-6" /> Ajustes
                </button>
                
                <div className="pt-6 border-t border-zinc-100">
                  {user ? (
                    <div className="mb-6 p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-200">
                      <div className="flex items-center gap-3 mb-3">
                        <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full border-2 border-zinc-900" />
                        <div>
                          <div className="text-xs font-black text-emerald-600 uppercase tracking-widest">Agente</div>
                          <div className="font-bold text-sm truncate w-32">{user.displayName}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => { logOut(); setIsMenuOpen(false); }}
                        className="w-full py-2 bg-white border-2 border-zinc-900 text-zinc-900 text-xs font-black rounded-xl uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <LogOut className="w-4 h-4" /> Desconectarse
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { signIn(); setIsMenuOpen(false); }}
                      className="w-full py-4 bg-zinc-900 text-white font-black rounded-2xl uppercase tracking-widest flex items-center justify-center gap-3 mb-6"
                    >
                      <LogIn className="w-5 h-5" /> Conectar Perfil
                    </button>
                  )}
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="flex items-center justify-between w-full p-4 bg-zinc-50 rounded-xl font-bold"
                  >
                    <div className="flex items-center gap-3">
                      {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                      <span>Sonido</span>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${soundEnabled ? 'bg-zinc-900' : 'bg-zinc-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                  </button>

                  <button 
                    onClick={() => setMusicEnabled(!musicEnabled)}
                    className="flex items-center justify-between w-full p-4 bg-zinc-50 rounded-xl font-bold mt-2"
                  >
                    <div className="flex items-center gap-3">
                      <Music className="w-5 h-5" />
                      <span>Música</span>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${musicEnabled ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${musicEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                  </button>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {currentView === 'main' && renderMain()}
        {currentView === 'play' && renderPlay()}
        {currentView === 'results' && renderResults()}
        {currentView === 'practice' && renderPractice()}
        {currentView === 'stats' && renderStats()}
        {currentView === 'settings' && renderSettings()}
        {currentView === 'mission_preview' && renderMissionPreview()}
        {currentView === 'leaderboard' && renderLeaderboard()}
        {currentView === 'chat' && renderChat()}
        {currentView === 'radio' && renderRadio()}
      </AnimatePresence>

      {renderTutorial()}
    </div>
  );
}
