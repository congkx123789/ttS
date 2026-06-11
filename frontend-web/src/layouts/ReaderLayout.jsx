import React, { useState, useEffect } from 'react';
import { useReaderSettings } from '../contexts/ReaderSettingsContext';
import { ArrowLeft, Settings, Menu, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ReaderLayout({ children, bookTitle, currentChapter, chaptersList, onSelectChapter }) {
  const { 
    theme, setTheme, fontSize, decreaseFontSize, increaseFontSize, 
    fontFamily, setFontFamily, lineHeight, setLineHeight 
  } = useReaderSettings();
  const navigate = useNavigate();

  const [overlayVisible, setOverlayVisible] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Toggle overlay on clicking center 40% area of screen
  useEffect(() => {
    const handleScreenClick = (e) => {
      const x = e.clientX;
      const width = window.innerWidth;
      const leftBoundary = width * 0.3;
      const rightBoundary = width * 0.7;

      // Ignore if clicking overlay menus or sidebars
      if (e.target.closest('.reader-overlay') || e.target.closest('.reader-sidebar')) {
        return;
      }

      if (x > leftBoundary && x < rightBoundary) {
        setOverlayVisible(prev => !prev);
        setShowSettingsPanel(false);
      }
    };

    window.addEventListener('click', handleScreenClick);
    return () => window.removeEventListener('click', handleScreenClick);
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-300 relative theme-${theme} select-none`}>
      {/* Overlay top menu */}
      <div 
        className={`reader-overlay fixed top-0 left-0 right-0 z-40 bg-[#0f0f1a]/95 border-b border-[#2d2d6b]/50 p-4 flex items-center justify-between text-slate-100 transition-all duration-300 ${
          overlayVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate">{bookTitle || 'Đang tải...'}</h4>
            <p className="text-slate-400 text-xs truncate mt-0.5">{currentChapter || 'Chương --'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettingsPanel(prev => !prev)} 
            className={`p-2 rounded-lg transition-colors ${showSettingsPanel ? 'bg-brand-500/25 text-brand-300' : 'hover:bg-white/10 text-slate-300'}`}
            title="Cài đặt giao diện"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Danh sách chương"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Floating Reader Settings Panel (Overlay bottom) */}
      <div 
        className={`reader-overlay fixed bottom-0 left-0 right-0 z-40 bg-[#0f0f1a]/95 border-t border-[#2d2d6b]/50 p-6 text-slate-100 transition-all duration-300 flex flex-col gap-4 max-w-2xl mx-auto rounded-t-2xl shadow-2xl ${
          (overlayVisible || showSettingsPanel) ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        {/* Background themes */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Màu nền</span>
          <div className="flex gap-3">
            {[
              { id: 'light', name: 'Sáng', bg: 'bg-white border-slate-300' },
              { id: 'sepia', name: 'Giấy cổ', bg: 'bg-[#f4ecd8] border-[#5c4033]/20' },
              { id: 'green', name: 'Bảo vệ mắt', bg: 'bg-[#dfedd6] border-[#2e4a3e]/20' },
              { id: 'dark', name: 'Tối', bg: 'bg-[#0b0b14] border-[#1f1f3a]' }
            ].map(t => (
              <button 
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${t.bg} ${
                  theme === t.id ? 'scale-110 border-brand-500 shadow-md' : 'opacity-80'
                }`}
                title={t.name}
              >
                {theme === t.id && (
                  <Check className={`w-4 h-4 ${t.id === 'light' ? 'text-black' : t.id === 'sepia' ? 'text-[#5c4033]' : t.id === 'green' ? 'text-[#2e4a3e]' : 'text-white'}`} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Font size adjustments */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cỡ chữ</span>
          <div className="flex items-center gap-3">
            <button 
              onClick={decreaseFontSize}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 rounded-lg transition-all"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold w-8 text-center">{fontSize}px</span>
            <button 
              onClick={increaseFontSize}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 rounded-lg transition-all"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Font Family Selection */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Font chữ</span>
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 text-xs">
            {[
              { id: 'sans', name: 'Không chân' },
              { id: 'serif', name: 'Có chân' },
              { id: 'mono', name: 'Đơn cách' }
            ].map(f => (
              <button 
                key={f.id}
                onClick={() => setFontFamily(f.id)}
                className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                  fontFamily === f.id ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Line heights adjustments */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Giãn dòng</span>
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 text-xs">
            {[
              { id: 'normal', name: 'Thường' },
              { id: 'relaxed', name: 'Rộng' },
              { id: 'loose', name: 'Rất rộng' }
            ].map(lh => (
              <button 
                key={lh.id}
                onClick={() => setLineHeight(lh.id)}
                className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                  lineHeight === lh.id ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400'
                }`}
              >
                {lh.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chapters Sidebar Drawer */}
      <div 
        className={`reader-sidebar fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[85vw] bg-[#0f0f1a] border-l border-[#2d2d6b]/50 p-5 flex flex-col gap-4 text-slate-100 transition-transform duration-300 shadow-2xl ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#2d2d6b]/50 pb-3">
          <h4 className="font-extrabold text-sm">Mục lục</h4>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="text-slate-400 hover:text-white"
          >
            Đóng
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {chaptersList && chaptersList.length > 0 ? (
            chaptersList.map((chap, idx) => (
              <button 
                key={idx}
                onClick={() => { onSelectChapter(chap); setSidebarOpen(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs hover:bg-white/5 transition-colors truncate ${
                  chap.active ? 'text-brand-300 bg-brand-500/10 font-bold' : 'text-slate-400'
                }`}
              >
                {chap.title}
              </button>
            ))
          ) : (
            <p className="text-slate-500 text-xs text-center py-6">Mục lục rỗng.</p>
          )}
        </div>
      </div>

      {/* Sidebar Overlay background */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 z-45 bg-black/50 backdrop-blur-sm"
        />
      )}

      {/* Text Container */}
      <div className="max-w-3xl mx-auto px-6 py-24 min-h-screen">
        {children}
      </div>
    </div>
  );
}
