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
  MousePointer2
} from 'lucide-react';
import { 
  MORSE_DICTIONARY, 
  REVERSE_MORSE_DICTIONARY, 
  SENTENCES, 
  DASH_THRESHOLD, 
  LETTER_WAIT_TIME 
} from './constants';
import { morseAudio, musicService } from './services/audioService';

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
  }, [stats]);

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
                  onClick={() => { setCurrentView('settings'); setIsMenuOpen(false); }}
                  className="flex items-center gap-4 w-full text-left font-bold text-lg hover:text-zinc-500 transition-colors"
                >
                  <SettingsIcon className="w-6 h-6" /> Ajustes
                </button>
                
                <div className="pt-6 border-t border-zinc-100">
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
      </AnimatePresence>

      {renderTutorial()}
    </div>
  );
}
