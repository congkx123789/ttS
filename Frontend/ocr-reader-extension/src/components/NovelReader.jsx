import React, { useState, useEffect, useRef } from 'react';

export default function NovelReader({ 
  chapterData, 
  onBack,
  currentParagraphIndex,
  setCurrentParagraphIndex
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(16); // px
  const [theme, setTheme] = useState('paper'); // 'paper' | 'white' | 'dark'
  const activeParaRef = useRef(null);

  useEffect(() => {
    if (activeParaRef.current) {
      activeParaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentParagraphIndex]);

  const paragraphs = chapterData?.paragraphs || [];
  const novelTitle = chapterData?.novelTitle || "Truyện Ngoài";
  const chapterTitle = chapterData?.chapterTitle || "Chương đọc";

  // Progress based on paragraphs scrolled or read
  const progressPercent = paragraphs.length 
    ? ((currentParagraphIndex + 1) / paragraphs.length) * 100 
    : 0;

  return (
    <div className={`absolute inset-0 z-50 flex flex-col overflow-hidden transition-colors duration-300 ${
      theme === 'paper' ? 'bg-[#F9F7F1] text-[#2c2c2c]' :
      theme === 'white' ? 'bg-white text-gray-900' :
      'bg-[#121212] text-gray-300'
    }`}>
      
      {/* TopAppBar */}
      <header className={`flex justify-between items-center h-[48px] px-4 w-full shrink-0 border-b z-10 sticky top-0 shadow-sm transition-colors duration-300 ${
        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white/80 backdrop-blur-md border-gray-200'
      }`}>
        <button 
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="text-sm font-bold truncate px-4 max-w-[250px] text-primary">
          {novelTitle}
        </h1>
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10"
        >
          <span className="material-symbols-outlined text-[20px]">format_size</span>
        </button>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 overflow-y-auto px-6 py-6 pb-24 custom-scrollbar">
        <h2 className="font-serif font-bold text-xl text-center mb-8">
          {chapterTitle}
        </h2>
        <div 
          className="font-serif leading-[1.8]"
          style={{ fontSize: `${fontSize}px` }}
        >
          {paragraphs.map((p, idx) => {
            const isActive = idx === currentParagraphIndex;
            return (
              <p 
                key={idx}
                ref={isActive ? activeParaRef : null}
                onClick={() => setCurrentParagraphIndex(idx)}
                className={`mb-[1.5em] indent-[1.5em] p-2 rounded-xl transition-all duration-300 cursor-pointer ${
                  isActive 
                    ? theme === 'dark' 
                      ? 'bg-primary/20 border-l-4 border-primary text-white shadow-sm' 
                      : 'bg-primary/10 border-l-4 border-primary text-black font-medium shadow-sm'
                    : 'border-l-4 border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {p}
              </p>
            );
          })}
          {paragraphs.length === 0 && (
            <p className="text-center text-sm text-gray-500 italic mt-12">Không tìm thấy nội dung văn bản chính.</p>
          )}
        </div>
      </main>

      {/* Reading Progress Bar */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 z-40">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
      </div>

      {/* Settings Overlay */}
      {isSettingsOpen && (
        <div className={`fixed top-14 right-4 w-[240px] rounded-xl shadow-lg border p-4 z-50 animate-in slide-in-from-top-2 fade-in duration-200 ${
          theme === 'dark' ? 'bg-gray-950 border-gray-850 text-white' : 'bg-white border-gray-200 text-gray-900'
        }`}>
          <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-200 dark:border-gray-800">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Tùy chỉnh hiển thị</p>
            <button onClick={() => setIsSettingsOpen(false)} className="material-symbols-outlined text-[16px] text-gray-400">close</button>
          </div>
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Cỡ chữ ({fontSize}px)</p>
            <div className="flex items-center gap-2 bg-gray-150 dark:bg-gray-900 p-1 rounded-lg">
              <button 
                onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
                className="flex-1 py-1 text-center hover:bg-black/10 dark:hover:bg-white/10 rounded-md font-bold"
              >
                A-
              </button>
              <button 
                onClick={() => setFontSize(prev => Math.min(24, prev + 2))}
                className="flex-1 py-1 text-center hover:bg-black/10 dark:hover:bg-white/10 rounded-md font-bold"
              >
                A+
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">Màu nền</p>
            <div className="flex gap-3 justify-between">
              <button 
                onClick={() => setTheme('paper')} 
                className="flex-1 h-8 rounded-lg bg-[#F9F7F1] border-2 border-primary text-[#2c2c2c] text-xs font-serif flex items-center justify-center font-bold shadow-sm"
              >
                Giấy
              </button>
              <button 
                onClick={() => setTheme('white')} 
                className="flex-1 h-8 rounded-lg bg-white border border-gray-300 text-gray-900 text-xs flex items-center justify-center font-bold shadow-sm"
              >
                Sáng
              </button>
              <button 
                onClick={() => setTheme('dark')} 
                className="flex-1 h-8 rounded-lg bg-[#121212] border border-gray-800 text-gray-300 text-xs flex items-center justify-center font-bold shadow-sm"
              >
                Tối
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
