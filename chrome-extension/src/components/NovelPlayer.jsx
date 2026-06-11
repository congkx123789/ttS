import React, { useState, useEffect } from 'react';

export default function NovelPlayer({ 
  chapterData, 
  onBack, 
  onReadText, 
  onOpenIndex,
  isPlaying,
  setIsPlaying,
  currentParagraphIndex,
  setCurrentParagraphIndex,
  playbackSpeed,
  setPlaybackSpeed,
  playbackEngine,
  setPlaybackEngine,
  selectedVoice,
  setSelectedVoice
}) {
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [voices, setVoices] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState(0); // 0 = off
  const [sleepTimeLeft, setSleepTimeLeft] = useState(0);

  // Load and filter voices (Vi, Zh, En)
  useEffect(() => {
    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const filtered = allVoices.filter(v => v.lang.includes('vi') || v.lang.includes('zh') || v.lang.includes('en'));
      setVoices(filtered);
      
      // Auto select Vietnamese voice if none selected
      if (!selectedVoice && filtered.length > 0) {
        const viVoice = filtered.find(v => v.lang.includes('vi') || v.name.toLowerCase().includes('viet'));
        if (viVoice) {
          setSelectedVoice(viVoice.name);
        } else {
          setSelectedVoice(filtered[0].name);
        }
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoice, setSelectedVoice]);

  // Sleep Timer logic
  useEffect(() => {
    if (sleepTimerSeconds <= 0) {
      setSleepTimeLeft(0);
      return;
    }
    setSleepTimeLeft(sleepTimerSeconds);

    const timer = setInterval(() => {
      setSleepTimeLeft(prev => {
        if (prev <= 1) {
          setIsPlaying(false);
          setSleepTimerSeconds(0);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sleepTimerSeconds, setIsPlaying]);

  const formatTime = (secs) => {
    if (secs <= 0) return "";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const paragraphs = chapterData?.paragraphs || [];
  const novelTitle = chapterData?.novelTitle || "Truyện Ngoài";
  const chapterTitle = chapterData?.chapterTitle || "Chương đọc";
  const author = chapterData?.author || "Tác giả ẩn";
  const cover = chapterData?.cover || "";
  const currentParagraphText = paragraphs[currentParagraphIndex] || "Hết chương truyện.";

  const hasCover = cover && (cover.startsWith('http') || cover.startsWith('data:image'));

  const progressPercent = paragraphs.length 
    ? (currentParagraphIndex / paragraphs.length) * 100 
    : 0;

  const handleProgressBarClick = (e) => {
    if (!paragraphs.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    const targetIdx = Math.floor(percentage * paragraphs.length);
    setCurrentParagraphIndex(Math.min(paragraphs.length - 1, targetIdx));
  };

  return (
    <div className="absolute inset-0 z-50 bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center h-[48px] px-4 w-full shrink-0 z-10 bg-gray-950/40 backdrop-blur-md border-b border-white/5">
        <button onClick={onBack} className="material-symbols-outlined text-white hover:bg-gray-800 p-1 rounded-full transition-colors">
          keyboard_arrow_down
        </button>
        <h1 className="text-sm font-semibold tracking-wider uppercase text-gray-300">Nghe Đọc AI</h1>
        <button onClick={() => setShowSettings(!showSettings)} className="material-symbols-outlined text-white hover:bg-gray-800 p-1 rounded-full transition-colors">
          settings
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 px-4 flex flex-col gap-4 relative">
        {/* Blurred Background cover */}
        <div className="absolute top-0 left-0 w-full h-[360px] -z-10 opacity-20 pointer-events-none">
          {hasCover ? (
            <img 
              alt="Background Blur" 
              className="w-full h-full object-cover blur-3xl scale-125" 
              src={cover}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-primary/30 to-transparent blur-3xl"></div>
          )}
        </div>

        {/* Album Art with gradients */}
        <div className="w-full max-w-[180px] aspect-[3/4] mt-6 rounded-2xl overflow-hidden relative shadow-[0_8px_30px_rgb(0,0,0,0.6)] mx-auto flex-shrink-0 border border-white/10 group">
          {hasCover ? (
            <img 
              alt="Book Cover" 
              className="w-full h-full object-cover" 
              src={cover}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary via-indigo-900 to-black flex flex-col justify-between p-4 text-center">
              <span className="text-[10px] text-primary-container font-mono tracking-widest uppercase opacity-75">Antigravity Reader</span>
              <div className="flex flex-col items-center">
                <span className="material-symbols-outlined text-4xl text-primary mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                <span className="text-sm font-bold text-white line-clamp-2 px-1">{novelTitle}</span>
              </div>
              <span className="text-[9px] text-gray-400 font-medium truncate">{author}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 text-center pointer-events-none">
            <span className="text-[8px] uppercase font-bold text-primary-container bg-primary/20 px-2 py-0.5 rounded-full self-center mb-1">
              {playbackEngine === 'cloud' ? 'AI Cloud' : 'Local TTS'}
            </span>
          </div>
        </div>

        {/* Metadata info */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-white line-clamp-1">{novelTitle}</h2>
          <p className="text-sm text-primary-container font-medium line-clamp-1">{chapterTitle}</p>
          <p className="text-xs text-gray-400">Tác giả: {author}</p>
        </div>

        {/* Caption Display Box (Active Paragraph) */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 min-h-[110px] max-h-[140px] overflow-y-auto flex flex-col justify-center items-center relative text-center custom-scrollbar">
          {isPlaying && (
            <div className="flex items-center gap-1 absolute top-2 right-3">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></span>
              <span className="text-[9px] text-primary uppercase font-bold tracking-wider">Đang đọc</span>
            </div>
          )}
          <p className="text-sm font-medium text-gray-100 leading-relaxed italic px-2">
            "{currentParagraphText}"
          </p>
        </div>

        {/* Playback Controls & Progress Bar */}
        <div className="flex flex-col gap-4 mt-2">
          {/* Progress Slider */}
          <div className="flex items-center gap-3 px-2">
            <div className="text-[10px] text-gray-400 font-mono w-8 text-right">
              {currentParagraphIndex}
            </div>
            <div 
              onClick={handleProgressBarClick}
              className="flex-1 h-1.5 bg-gray-800 rounded-full relative cursor-pointer hover:h-2 transition-all"
            >
              <div 
                className="absolute top-0 left-0 h-full bg-primary rounded-full" 
                style={{ width: `${progressPercent}%` }}
              ></div>
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg border border-primary transition-transform scale-75 hover:scale-100"
                style={{ left: `calc(${progressPercent}% - 7px)` }}
              ></div>
            </div>
            <div className="text-[10px] text-gray-400 font-mono w-8">
              {paragraphs.length}
            </div>
          </div>
          
          {/* Main Controls Panel */}
          <div className="flex justify-between items-center px-4">
            <button 
              onClick={() => setCurrentParagraphIndex(prev => Math.max(0, prev - 5))}
              className="material-symbols-outlined text-gray-400 text-2xl hover:text-white transition-colors cursor-pointer"
              title="Lùi 5 đoạn"
            >
              replay_5
            </button>
            <button 
              onClick={() => setCurrentParagraphIndex(prev => Math.max(0, prev - 1))}
              className="material-symbols-outlined text-gray-400 text-3xl hover:text-white transition-colors cursor-pointer"
              title="Đoạn trước"
            >
              skip_previous
            </button>
            
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-14 h-14 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-3xl">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button 
              onClick={() => {
                if (currentParagraphIndex + 1 < paragraphs.length) {
                  setCurrentParagraphIndex(prev => prev + 1);
                } else {
                  alert("Đã đến cuối chương truyện!");
                }
              }}
              className="material-symbols-outlined text-gray-400 text-3xl hover:text-white transition-colors cursor-pointer"
              title="Đoạn sau"
            >
              skip_next
            </button>
            <button 
              onClick={() => setCurrentParagraphIndex(prev => Math.min(paragraphs.length - 1, prev + 5))}
              className="material-symbols-outlined text-gray-400 text-2xl hover:text-white transition-colors cursor-pointer"
              title="Tiến 5 đoạn"
            >
              forward_5
            </button>
          </div>

          {/* Quick Toolbar */}
          <div className="grid grid-cols-3 gap-2 bg-white/5 border border-white/5 p-2 rounded-xl text-center mt-2">
            <div className="flex flex-col items-center justify-center p-1 border-r border-white/5 min-w-[80px]">
              <span className="text-[10px] text-gray-400 uppercase font-bold mb-1.5">Tốc độ ({playbackSpeed}x)</span>
              <input 
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={playbackSpeed} 
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="w-full accent-primary bg-gray-800 cursor-pointer h-1 rounded-lg"
              />
            </div>

            <div className="flex flex-col items-center justify-center p-1 border-r border-white/5">
              <span className="text-[10px] text-gray-400 uppercase font-bold mb-1">Nguồn phát</span>
              <select 
                value={playbackEngine} 
                onChange={(e) => setPlaybackEngine(e.target.value)}
                className="bg-transparent text-sm font-semibold text-primary focus:outline-none cursor-pointer"
              >
                <option value="local" className="bg-gray-900">Local (M.Phí)</option>
                <option value="cloud" className="bg-gray-900">Cloud AI</option>
              </select>
            </div>

            <div className="flex flex-col items-center justify-center p-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold mb-1">Hẹn giờ</span>
              <select 
                value={sleepTimerSeconds} 
                onChange={(e) => setSleepTimerSeconds(parseInt(e.target.value))}
                className="bg-transparent text-sm font-semibold text-primary focus:outline-none cursor-pointer"
              >
                <option value="0" className="bg-gray-900">Tắt</option>
                <option value="900" className="bg-gray-900">15 phút</option>
                <option value="1800" className="bg-gray-900">30 phút</option>
                <option value="2700" className="bg-gray-900">45 phút</option>
                <option value="3600" className="bg-gray-900">60 phút</option>
              </select>
              {sleepTimeLeft > 0 && (
                <span className="text-[9px] text-red-400 font-mono mt-0.5">{formatTime(sleepTimeLeft)}</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center mt-2">
            <button 
              onClick={onReadText}
              className="flex-1 max-w-[150px] bg-white/10 text-gray-200 border border-white/10 px-4 py-2 rounded-full text-xs font-semibold hover:bg-white/20 transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">menu_book</span>
              Đọc nguyên văn
            </button>
            <button 
              onClick={() => setIsAIChatOpen(true)}
              className="flex-1 max-w-[150px] bg-primary/20 text-primary border border-primary/20 px-4 py-2 rounded-full text-xs font-semibold hover:bg-primary/30 transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">smart_toy</span>
              Hỏi AI chương này
            </button>
          </div>
        </div>
      </div>

      {/* Slide-Up Overlay for Detailed Voice Settings */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-end animate-in fade-in duration-200">
          <div className="w-full bg-gray-950 border-t border-white/10 rounded-t-3xl p-6 space-y-4 max-h-[70%] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Cài đặt giọng đọc</h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="material-symbols-outlined text-gray-400 hover:text-white"
              >
                close
              </button>
            </div>

            {playbackEngine === 'local' ? (
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-bold block">Chọn Giọng đọc hệ thống</label>
                <div className="max-h-[180px] overflow-y-auto border border-white/10 rounded-xl divide-y divide-white/5 bg-white/5 custom-scrollbar">
                  {voices.map((v) => (
                    <div 
                      key={v.name}
                      onClick={() => {
                        setSelectedVoice(v.name);
                        setShowSettings(false);
                      }}
                      className={`p-3 text-xs flex justify-between items-center cursor-pointer hover:bg-white/5 ${selectedVoice === v.name ? 'text-primary font-bold bg-primary/5' : 'text-gray-300'}`}
                    >
                      <span className="truncate max-w-[80%]">{v.name} ({v.lang})</span>
                      {selectedVoice === v.name && (
                        <span className="material-symbols-outlined text-primary text-[16px]">check</span>
                      )}
                    </div>
                  ))}
                  {voices.length === 0 && (
                    <p className="p-4 text-center text-xs text-gray-500">Đang tải danh sách giọng đọc của trình duyệt...</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed bg-primary/5 p-3 rounded-lg border border-primary/20">
                  ⚠️ Giọng đọc AI Cloud sử dụng mô hình cao cấp của máy chủ. Cần thiết lập RUNPOD_API_TOKEN để chạy online ổn định 100%. Nếu xảy ra lỗi hoặc thiếu số dư, trình phát sẽ tự động chuyển về giọng đọc Local.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Assistant Sheet Overlay */}
      <div 
        className={`absolute bottom-0 left-0 w-full h-[75%] bg-gray-950 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] border-t border-white/10 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isAIChatOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div>
              <span className="text-sm font-bold text-white block">Zhaojun AI Trợ Lý</span>
              <span className="text-[10px] text-gray-400">Phân tích sâu chương truyện</span>
            </div>
          </div>
          <button onClick={() => setIsAIChatOpen(false)} className="material-symbols-outlined text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800">
            close
          </button>
        </div>

        {/* Simulated Chat Content with accurate context */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4">
          <div className="flex gap-3 max-w-[85%]">
            <div className="bg-white/5 border border-white/5 text-xs text-gray-200 p-3 rounded-2xl rounded-tl-sm shadow-sm leading-relaxed">
              Xin chào! Tôi có thể trả lời mọi câu hỏi về chương <strong>{chapterTitle}</strong> của cuốn truyện này. Bạn có muốn phân tích âm mưu ẩn giấu, tóm tắt diễn biến chính hay giải thích các điển tích tu luyện trong chương này không?
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/5 bg-gray-950 shrink-0">
          <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 border border-white/10 focus-within:border-primary transition-colors">
            <input 
              className="flex-1 bg-transparent border-none text-xs text-white focus:ring-0 focus:outline-none placeholder-gray-500" 
              placeholder="Hỏi AI về nội dung chương..." 
              type="text" 
            />
            <span className="material-symbols-outlined text-primary cursor-pointer hover:text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          </div>
        </div>
      </div>
    </div>
  );
}
