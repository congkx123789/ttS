import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, X, Music, Volume2, Settings, Minimize2, SkipForward, SkipBack, Loader } from 'lucide-react';
import api from '../services/api';

export default function AudioPlayer({ book, onClose, onNextChapter }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // TTS Engine selection ('browser' | 'matcha')
  const [ttsEngine, setTtsEngine] = useState(() => {
    return localStorage.getItem('local_tts_engine') || 'browser';
  });

  // API Key for Matcha-TTS
  const [matchaApiKey, setMatchaApiKey] = useState(() => {
    return localStorage.getItem('local_tts_api_key') || '';
  });

  // Voice for Matcha-TTS
  const [matchaVoice, setMatchaVoice] = useState(() => {
    return localStorage.getItem('local_tts_voice') || 'the_gioi_hoan_my';
  });

  // Browser TTS parameters
  const [rate, setRate] = useState(1.05);
  const [pitch, setPitch] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  
  // Progress tracking
  const [progress, setProgress] = useState(0);

  const synthRef = useRef(window.speechSynthesis);
  const utteranceRef = useRef(null);
  const audioRef = useRef(null);
  
  // Refs for segmented sentence queue player (Matcha-TTS)
  const sentencesRef = useRef([]);
  const currentSentenceIdxRef = useRef(0);
  const audioCacheRef = useRef({});
  const prefetchQueueRef = useRef(new Set());

  // Auto-fetch API key if logged in and not present
  useEffect(() => {
    if (ttsEngine === 'matcha' && !matchaApiKey) {
      api.get('/api/developer/keys').then(res => {
        if (res.data && res.data.keys && res.data.keys.length > 0) {
          const key = res.data.keys[0].api_key;
          setMatchaApiKey(key);
          localStorage.setItem('local_tts_api_key', key);
        }
      }).catch(e => {
        console.log("No user developer keys found (probably not logged in or doesn't have keys)");
      });
    }
  }, [ttsEngine, matchaApiKey]);

  // Load browser speech voices on mount
  useEffect(() => {
    const loadVoices = () => {
      if (!synthRef.current) return;
      const allVoices = synthRef.current.getVoices();
      setVoices(allVoices);
      
      // Default to Vietnamese or first found voice
      const viVoice = allVoices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
      if (viVoice) {
        setSelectedVoiceName(viVoice.name);
      } else if (allVoices.length > 0) {
        setSelectedVoiceName(allVoices[0].name);
      }
    };

    loadVoices();
    if (synthRef.current && synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    return () => {
      stopSpeaking();
    };
  }, []);

  // Save selected settings to localStorage on change
  const handleSaveEngine = (engine) => {
    setTtsEngine(engine);
    localStorage.setItem('local_tts_engine', engine);
    stopSpeaking();
  };

  const handleSaveApiKey = (val) => {
    setMatchaApiKey(val);
    localStorage.setItem('local_tts_api_key', val);
    stopSpeaking();
  };

  const handleSaveVoice = (val) => {
    setMatchaVoice(val);
    localStorage.setItem('local_tts_voice', val);
    stopSpeaking();
  };

  // Real-time speed adjustment (does not restart Matcha playback!)
  useEffect(() => {
    if (ttsEngine === 'matcha' && audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, [rate]);

  // Restart speech when book, engine, voice, or selectedVoiceName changes
  useEffect(() => {
    if (book) {
      speakContent();
    }
    return () => {
      stopSpeaking();
    };
  }, [book, ttsEngine, selectedVoiceName, matchaVoice]);

  const fetchMatchaAudio = async (idx, retryCount = 2) => {
    if (idx >= sentencesRef.current.length) return null;
    
    // Check cache
    if (audioCacheRef.current[idx]) {
      return audioCacheRef.current[idx];
    }

    const text = sentencesRef.current[idx];
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const res = await api.post('/v1/audio/speech', {
          input: text,
          speed: 1.0, // Server always returns standard x1 audio
          voice: matchaVoice
        }, {
          responseType: 'blob',
          headers: {
            'Authorization': `Bearer ${matchaApiKey}`
          }
        });

        const audioUrl = URL.createObjectURL(res.data);
        const audio = new Audio(audioUrl);
        audioCacheRef.current[idx] = audio;
        return audio;
      } catch (err) {
        if (attempt === retryCount) {
          throw err;
        }
        console.warn(`[Web TTS] Fetch Matcha Audio attempt ${attempt} failed, retrying...`, err);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const prefetchMatchaSentence = (idx) => {
    if (idx >= sentencesRef.current.length || idx < 0) return;
    if (audioCacheRef.current[idx] || prefetchQueueRef.current.has(idx)) return;

    prefetchQueueRef.current.add(idx);
    fetchMatchaAudio(idx)
      .then(() => {
        prefetchQueueRef.current.delete(idx);
      })
      .catch(err => {
        console.log("Failed to prefetch sentence", idx, err);
        prefetchQueueRef.current.delete(idx);
      });
  };

  const playMatchaSentence = async (idx) => {
    if (idx >= sentencesRef.current.length) {
      // Finished all sentences! Go to next chapter!
      setIsPlaying(false);
      setProgress(100);
      if (book.isChapter && onNextChapter) {
        onNextChapter();
      }
      return;
    }

    currentSentenceIdxRef.current = idx;
    
    // Calculate progress as fraction of played sentences
    setProgress(Math.round((idx / sentencesRef.current.length) * 100));

    // If active audio is playing, pause it
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    let audio = audioCacheRef.current[idx];
    if (!audio) {
      setIsLoading(true);
      try {
        audio = await fetchMatchaAudio(idx);
      } catch (err) {
        console.error(err);
        setIsLoading(false);
        alert("Lỗi phát audio AI cho câu: " + sentencesRef.current[idx]);
        return;
      }
    }

    setIsLoading(false);
    audioRef.current = audio;
    audio.playbackRate = rate;

    audio.onplay = () => {
      setIsPlaying(true);
      audio.playbackRate = rate;
    };

    audio.onplaying = () => {
      audio.playbackRate = rate;
    };

    audio.onpause = () => {
      setIsPlaying(false);
    };

    audio.onended = () => {
      // Play next sentence!
      playMatchaSentence(idx + 1);
    };

    audio.onerror = (e) => {
      console.error("Audio playback error at sentence", idx, e);
      setIsPlaying(false);
    };

    audio.play()
      .then(() => {
        audio.playbackRate = rate;
      })
      .catch(e => console.log("Play interrupted or blocked:", e));

    // Prefetch next 4 sentences in the background!
    for (let offset = 1; offset <= 4; offset++) {
      prefetchMatchaSentence(idx + offset);
    }
  };

  const speakContent = async () => {
    stopSpeaking();

    const titleText = book.title_vietphrase || book.title || '';
    const authorText = book.author_hanviet || book.author || '';
    const mainText = book.description_vietphrase || book.description || '';

    if (!titleText && !mainText) return;

    let textToSpeak = "";
    if (book.isChapter) {
      textToSpeak = `${titleText}. ${mainText}`;
    } else {
      textToSpeak = `Giới thiệu tác phẩm: ${titleText}. Tác giả: ${authorText}. Tóm tắt cốt truyện: ${mainText}. Hết phần tóm tắt.`;
    }

    if (ttsEngine === 'matcha') {
      if (!matchaApiKey) {
        // Just stop and wait for key
        return;
      }
      
      // Segment text into clean, larger chunks (paragraphs/large sentences) for continuous reading
      const paragraphs = textToSpeak.split(/[\n\r]+/);
      const rawSentences = [];
      for (const para of paragraphs) {
        const trimmedPara = para.trim();
        if (!trimmedPara) continue;
        if (trimmedPara.length <= 400) {
          rawSentences.push(trimmedPara);
        } else {
          // If paragraph is too long, split it by sentence boundaries to avoid server timeouts
          const sentences = trimmedPara.split(/([.!?。！？])/);
          let currentChunk = "";
          for (let i = 0; i < sentences.length; i++) {
            const part = sentences[i];
            if (['.', '!', '?', '。', '！', '？'].includes(part)) {
              currentChunk += part;
            } else {
              if (currentChunk.trim() && currentChunk.length + part.length > 400) {
                rawSentences.push(currentChunk.trim());
                currentChunk = part;
              } else {
                currentChunk += part;
              }
            }
          }
          if (currentChunk.trim()) {
            rawSentences.push(currentChunk.trim());
          }
        }
      }

      if (rawSentences.length === 0) return;

      sentencesRef.current = rawSentences;
      currentSentenceIdxRef.current = 0;
      audioCacheRef.current = {};
      prefetchQueueRef.current = new Set();

      playMatchaSentence(0);
    } else {
      // Browser Synthesis Engine
      if (!synthRef.current) return;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      if (selectedVoiceName) {
        const voiceObj = voices.find(v => v.name === selectedVoiceName);
        if (voiceObj) {
          utterance.voice = voiceObj;
        }
      } else {
        utterance.lang = 'vi-VN';
      }

      utterance.rate = rate;
      utterance.pitch = pitch;

      utterance.onstart = () => {
        setIsPlaying(true);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setProgress(100);
        if (book.isChapter && onNextChapter) {
          onNextChapter();
        }
      };

      utterance.onerror = (e) => {
        if (e.error !== 'interrupted') {
          console.error("Speech Synthesis Error:", e);
          setIsPlaying(false);
        }
      };

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const idx = event.charIndex;
          if (typeof book.onBoundary === 'function') {
            book.onBoundary(idx);
          }
          const totalLen = textToSpeak.length;
          if (totalLen > 0) {
            setProgress(Math.min(100, Math.round((idx / totalLen) * 100)));
          }
        }
      };

      utteranceRef.current = utterance;
      synthRef.current.speak(utterance);
    }
  };

  const togglePlay = () => {
    if (ttsEngine === 'matcha') {
      if (isLoading) return;
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play();
          setIsPlaying(true);
        }
      } else {
        speakContent();
      }
    } else {
      if (!synthRef.current) return;
      if (isPlaying) {
        synthRef.current.pause();
        setIsPlaying(false);
      } else {
        if (synthRef.current.paused) {
          synthRef.current.resume();
          setIsPlaying(true);
        } else {
          speakContent();
        }
      }
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    // Clean up cache object URLs to avoid memory leaks
    if (audioCacheRef.current) {
      Object.values(audioCacheRef.current).forEach(audio => {
        try {
          if (audio.src) {
            URL.revokeObjectURL(audio.src);
          }
        } catch (e) {}
      });
      audioCacheRef.current = {};
    }
    if (prefetchQueueRef.current) {
      prefetchQueueRef.current.clear();
    }
    sentencesRef.current = [];
    currentSentenceIdxRef.current = 0;
    
    setIsPlaying(false);
    setIsLoading(false);
  };

  const handleClose = () => {
    stopSpeaking();
    onClose && onClose();
  };

  const skipForward = () => {
    if (ttsEngine === 'matcha') {
      const nextIdx = currentSentenceIdxRef.current + 1;
      if (nextIdx < sentencesRef.current.length) {
        playMatchaSentence(nextIdx);
      } else if (book.isChapter && onNextChapter) {
        onNextChapter();
      }
    } else {
      // Browser speech synthesis basic skip forward
      const nextProgress = Math.min(90, progress + 10);
      const textToSpeak = (book.isChapter ? `${book.title_vietphrase}. ${book.description}` : book.description) || "";
      const nextIndex = Math.floor((nextProgress / 100) * textToSpeak.length);
      
      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(textToSpeak.slice(nextIndex));
      if (selectedVoiceName) {
        const voiceObj = voices.find(v => v.name === selectedVoiceName);
        if (voiceObj) utterance.voice = voiceObj;
      }
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => {
        setIsPlaying(false);
        if (book.isChapter && onNextChapter) onNextChapter();
      };
      utterance.onboundary = (event) => {
        const idx = nextIndex + event.charIndex;
        const totalLen = textToSpeak.length;
        setProgress(Math.min(100, Math.round((idx / totalLen) * 100)));
      };
      utteranceRef.current = utterance;
      synthRef.current.speak(utterance);
    }
  };

  const skipBackward = () => {
    if (ttsEngine === 'matcha') {
      const prevIdx = currentSentenceIdxRef.current - 1;
      if (prevIdx >= 0) {
        playMatchaSentence(prevIdx);
      }
    } else {
      const prevProgress = Math.max(0, progress - 10);
      const textToSpeak = (book.isChapter ? `${book.title_vietphrase}. ${book.description}` : book.description) || "";
      const prevIndex = Math.floor((prevProgress / 100) * textToSpeak.length);

      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(textToSpeak.slice(prevIndex));
      if (selectedVoiceName) {
        const voiceObj = voices.find(v => v.name === selectedVoiceName);
        if (voiceObj) utterance.voice = voiceObj;
      }
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => {
        setIsPlaying(false);
        if (book.isChapter && onNextChapter) onNextChapter();
      };
      utterance.onboundary = (event) => {
        const idx = prevIndex + event.charIndex;
        const totalLen = textToSpeak.length;
        setProgress(Math.min(100, Math.round((idx / totalLen) * 100)));
      };
      utteranceRef.current = utterance;
      synthRef.current.speak(utterance);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 bg-[#121225]/95 border border-purple-500/40 rounded-full p-2.5 shadow-2xl flex items-center gap-2 cursor-pointer hover:border-purple-400 transition-all hover:scale-105" onClick={() => setIsMinimized(false)}>
        {/* Minimized Wave animation */}
        <div className="flex items-center justify-center bg-purple-600 rounded-full w-10 h-10 relative">
          {isLoading ? (
            <Loader className="w-5 h-5 text-white animate-spin" />
          ) : isPlaying ? (
            <div className="flex gap-[2px] items-center h-4">
              <div className="w-[2px] h-3 bg-white animate-pulse" />
              <div className="w-[2px] h-4 bg-white animate-pulse" style={{ animationDelay: '0.15s' }} />
              <div className="w-[2px] h-2 bg-white animate-pulse" style={{ animationDelay: '0.3s' }} />
            </div>
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </div>
        <span className="text-[10px] text-white font-bold pr-2 max-w-[120px] truncate">
          {book.title_vietphrase || book.title}
        </span>
        <button 
          onClick={(e) => { e.stopPropagation(); handleClose(); }} 
          className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:right-6 sm:left-auto z-50 bg-[#121225]/97 border-t sm:border border-purple-500/30 backdrop-blur-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 w-full sm:max-w-sm sm:w-[340px] animate-in fade-in slide-in-from-bottom-5 duration-300">
      {/* Header Bar */}
      <div className="flex justify-between items-center pb-2 border-b border-white/5">
        <span className="text-[9px] text-purple-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
          <Volume2 className="w-3.5 h-3.5" /> 
          {book.isChapter ? 'ĐANG ĐỌC CHƯƠNG...' : 'ĐANG NGHE TÓM TẮT...'}
        </span>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-purple-600/20 text-purple-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            title="Cấu hình giọng đọc"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-slate-400 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
            title="Thu nhỏ"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button 
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Info */}
      <div className="flex gap-4 items-center">
        {book.cover ? (
          <img
            src={book.cover}
            alt="cover"
            className={`w-12 h-16 object-cover rounded-lg border border-white/10 shadow-md shrink-0 bg-[#0f0f1a] ${isPlaying ? 'animate-pulse' : ''}`}
            onError={(e) => { e.target.remove(); }}
          />
        ) : (
          <div className="w-12 h-16 rounded-lg border border-white/10 bg-[#0f0f1a] flex items-center justify-center text-slate-500 shrink-0">
            <Music className="w-5 h-5 text-purple-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h4 className="text-white text-xs font-bold truncate">{book.title_vietphrase || book.title}</h4>
          <p className="text-[10px] text-slate-500 truncate mt-0.5">✍ Tác giả: {book.author_hanviet || book.author || '—'}</p>
          
          {/* Progress Bar */}
          <div className="w-full bg-[#0b0b14] rounded-full h-1.5 mt-2.5 relative overflow-hidden">
            <div 
              className="bg-purple-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[8px] text-slate-500 mt-1">
            <span>Tiến trình</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>

      {/* Speech Settings Sub-panel */}
      {showSettings && (
        <div className="bg-[#0b0b14]/75 border border-white/5 rounded-xl p-3 text-[10px] space-y-3 animate-in fade-in duration-200">
          {/* Engine Selector */}
          <div className="space-y-1">
            <label className="text-slate-400 font-bold block">Động cơ đọc (TTS Engine):</label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#121225] p-1 rounded-lg border border-[#1f1f3a]">
              <button
                type="button"
                onClick={() => handleSaveEngine('browser')}
                className={`py-1 rounded-md text-[9px] font-bold transition-all ${ttsEngine === 'browser' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Trình duyệt (Free)
              </button>
              <button
                type="button"
                onClick={() => handleSaveEngine('matcha')}
                className={`py-1 rounded-md text-[9px] font-bold transition-all ${ttsEngine === 'matcha' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Matcha-TTS (GPU)
              </button>
            </div>
          </div>

          {ttsEngine === 'matcha' ? (
            <>
              {/* Matcha Voice */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">Giọng đọc AI (Matcha):</label>
                <select
                  value={matchaVoice}
                  onChange={(e) => handleSaveVoice(e.target.value)}
                  className="w-full bg-[#121225] border border-[#1f1f3a] text-slate-200 p-2 rounded-lg outline-none focus:border-purple-500"
                >
                  <option value="the_gioi_hoan_my">Thế Giới Hoàn Mỹ (Giọng Nam)</option>
                  <option value="vi_female">Giọng Nữ miền Bắc (Beta)</option>
                </select>
              </div>

              {/* Matcha API Key */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">API Key (sk-tc-...):</label>
                <input
                  type="password"
                  value={matchaApiKey}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                  placeholder="Nhập API key của bạn để sử dụng"
                  className="w-full bg-[#121225] border border-[#1f1f3a] text-slate-200 px-2.5 py-1.5 rounded-lg outline-none focus:border-purple-500 text-xs"
                />
                <span className="text-[8px] text-slate-500 block leading-tight">
                  Lấy khóa API tại tab <strong>API Developer</strong>. Số dư sẽ tự động bị khấu trừ từ tài khoản.
                </span>
              </div>
            </>
          ) : (
            /* Browser Voice Selector */
            <div className="space-y-1">
              <label className="text-slate-400 font-bold block">Giọng đọc (Voice):</label>
              <select
                value={selectedVoiceName}
                onChange={(e) => setSelectedVoiceName(e.target.value)}
                className="w-full bg-[#121225] border border-[#1f1f3a] text-slate-200 p-2 rounded-lg outline-none focus:border-purple-500"
              >
                {voices.map((v, i) => (
                  <option key={i} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Speed & Pitch settings */}
          <div className="grid grid-cols-2 gap-3">
            {/* Speed selection */}
            <div className="space-y-1">
              <label className="text-slate-400 font-bold block">Tốc độ ({rate}x):</label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full accent-purple-500 bg-[#121225]"
              />
            </div>
            
            {/* Pitch selection */}
            <div className="space-y-1">
              <label className="text-slate-400 font-bold block">Cao độ ({pitch}):</label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={pitch}
                disabled={ttsEngine === 'matcha'} // Matcha-TTS pitch is not adjustable on web
                className="w-full accent-purple-500 bg-[#121225] disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-4 border-t border-white/5 pt-2">
        <button
          onClick={skipBackward}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          title={ttsEngine === 'matcha' ? "Tua lại 15 giây" : "Tua lại 10%"}
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="p-3 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white rounded-full shadow-lg transition-all disabled:opacity-40"
        >
          {isLoading ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 fill-current" />
          )}
        </button>

        <button
          onClick={skipForward}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          title={ttsEngine === 'matcha' ? "Tua đi 15 giây" : "Tua đi 10%"}
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
