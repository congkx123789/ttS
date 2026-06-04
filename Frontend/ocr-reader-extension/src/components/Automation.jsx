import React, { useState, useEffect } from 'react';

function Automation() {
  const [toggles, setToggles] = useState({
    autoTranslate: false,
    autoNext: true,
    cleanText: false
  });
  const [selector, setSelector] = useState('.next-btn, #next-chap, a:contains("下一章"), a[rel="next"]');
  const [autoNextDelay, setAutoNextDelay] = useState(3); // default 3 seconds delay

  // Load state từ chrome storage khi mở popup
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['autoTranslate', 'autoNext', 'cleanText', 'nextChapterSelector', 'autoNextDelay'], (result) => {
        setToggles(prev => ({
          ...prev,
          autoTranslate: result.autoTranslate || false,
          autoNext: result.autoNext !== undefined ? result.autoNext : true,
          cleanText: result.cleanText || false
        }));
        if (result.nextChapterSelector) {
          setSelector(result.nextChapterSelector);
        }
        if (result.autoNextDelay !== undefined) {
          setAutoNextDelay(result.autoNextDelay);
        }
      });
    }
  }, []);

  const handleToggle = (key) => {
    setToggles(prev => {
      const newState = { ...prev, [key]: !prev[key] };
      // Lưu lại vào chrome storage ngay lập tức
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ [key]: newState[key] });
      }
      return newState;
    });
  };

  const handleSelectorChange = (val) => {
    setSelector(val);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ nextChapterSelector: val });
    }
  };

  const handleDelayChange = (val) => {
    setAutoNextDelay(val);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ autoNextDelay: val });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-container-padding py-section-margin space-y-6">
      {/* Summary Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <span className="material-symbols-outlined text-[64px]">robot_2</span>
        </div>
        <h2 className="text-label-md font-label-md text-primary uppercase tracking-wider mb-1">Trạng thái hiện tại</h2>
        <p className="text-headline-xs font-headline-xs text-on-background">Đang hoạt động</p>
        <div className="mt-4 flex gap-2">
          <span className="px-2 py-1 bg-primary-container text-on-primary-fixed rounded text-label-sm font-label-sm">
            {Object.values(toggles).filter(Boolean).length} quy trình bật
          </span>
          <span className="px-2 py-1 bg-surface-container-high text-on-surface-variant rounded text-label-sm font-label-sm">V.1.2.0</span>
        </div>
      </div>

      {/* Automation List */}
      <div className="space-y-2.5">
        <p className="text-label-md font-label-md text-on-surface-variant px-1 mb-2">Cấu hình đọc</p>
        
        {/* Toggle Item 1 */}
        <div className={`flex items-center justify-between h-[48px] px-3 border border-outline-variant rounded-lg transition-colors ${toggles.autoTranslate ? 'bg-primary-container/10' : 'bg-surface-container-lowest hover:bg-surface-container-low'}`}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">translate</span>
            <span className="text-body-md font-body-md text-on-background">Tự động dịch trang mới</span>
          </div>
          <label className="ios-toggle">
            <input type="checkbox" checked={toggles.autoTranslate} onChange={() => handleToggle('autoTranslate')} />
            <span className="slider"></span>
          </label>
        </div>

        {/* Toggle Item 2 (Advanced layout with delay config) */}
        <div className={`flex flex-col border border-outline-variant rounded-lg transition-all p-3 space-y-2.5 ${toggles.autoNext ? 'bg-primary-container/10 border-primary/30' : 'bg-surface-container-lowest hover:bg-surface-container-low'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">skip_next</span>
              <span className="text-body-md font-body-md text-on-background">Tự động chuyển chương</span>
            </div>
            <label className="ios-toggle">
              <input type="checkbox" checked={toggles.autoNext} onChange={() => handleToggle('autoNext')} />
              <span className="slider"></span>
            </label>
          </div>
          
          {toggles.autoNext && (
            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/60 text-xs text-on-surface-variant animate-fade-in">
              <span className="font-semibold">Thời gian chờ chuyển trang:</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  min="0" 
                  max="60" 
                  value={autoNextDelay} 
                  onChange={(e) => handleDelayChange(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-14 h-7 bg-surface border border-outline-variant rounded px-2 text-center text-on-background font-bold focus:outline-none focus:border-primary text-xs"
                />
                <span className="font-medium">giây</span>
              </div>
            </div>
          )}
        </div>

        {/* Toggle Item 3 */}
        <div className={`flex items-center justify-between h-[48px] px-3 border border-outline-variant rounded-lg transition-colors ${toggles.cleanText ? 'bg-primary-container/10' : 'bg-surface-container-lowest hover:bg-surface-container-low'}`}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">cleaning_services</span>
            <span className="text-body-md font-body-md text-on-background">Lọc rác văn bản</span>
          </div>
          <label className="ios-toggle">
            <input type="checkbox" checked={toggles.cleanText} onChange={() => handleToggle('cleanText')} />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      {/* Input Section */}
      <div className="mt-section-margin">
        <p className="text-label-md font-label-md text-on-surface-variant px-1 mb-2">Kỹ thuật</p>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
          <label className="block text-label-md font-label-md text-on-surface-variant mb-2" htmlFor="selector">Selector Chương Tiếp</label>
          <div className="relative">
            <input 
              className="w-full h-9 bg-surface-bright border border-outline-variant rounded-lg px-3 text-body-sm font-body-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary-container transition-all" 
              id="selector" 
              placeholder=".next-btn, #next-chap" 
              type="text" 
              value={selector}
              onChange={(e) => handleSelectorChange(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline-variant text-[18px]">code</span>
          </div>
          <p className="mt-2 text-label-sm font-label-sm text-on-surface-variant leading-relaxed">
              Nhập CSS Selector của nút "Chương sau" để hệ thống tự động nhận diện liên kết (Ví dụ: <code>.next-btn, #next-chap</code> hoặc dùng cú pháp chứa văn bản <code>a:contains("下一章")</code>).
          </p>
        </div>
      </div>

      {/* Advanced Action */}
      <button 
        onClick={() => {
          if (typeof chrome !== 'undefined' && chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
          } else {
            alert("Vui lòng mở trang cài đặt trong quản lý Extension.");
          }
        }}
        className="mt-section-margin w-full h-9 flex items-center justify-center gap-2 bg-secondary text-on-secondary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity active:scale-95 duration-100 mb-8"
      >
        <span className="material-symbols-outlined text-[18px]">rebase_edit</span>
        Cấu hình nâng cao trong Dashboard
      </button>
    </div>
  );
}

export default Automation;
