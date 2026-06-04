import React, { useState, useEffect } from 'react';

export default function RecentlyTranslated() {
  const [history, setHistory] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['offlineTranslationHistory', 'serverUser'], (result) => {
        setIsLoggedIn(!!result.serverUser);
        if (result.offlineTranslationHistory && result.offlineTranslationHistory.length > 0) {
          setHistory(result.offlineTranslationHistory);
        }
      });
      
      const listener = (changes, namespace) => {
        if (namespace === 'local') {
          if (changes.offlineTranslationHistory) {
            setHistory(changes.offlineTranslationHistory.newValue || []);
          }
          if (changes.serverUser) {
            setIsLoggedIn(!!changes.serverUser.newValue);
          }
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  // If user is logged in, we do not show the local offline history on the main tab
  if (isLoggedIn) {
    return null;
  }

  if (history.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="font-headline-xs text-headline-xs text-on-surface">Trang đã dịch gần đây (Offline)</h2>
        <div className="p-4 text-center bg-surface-container-lowest border border-slate-100 rounded-lg">
          <p className="text-body-sm text-outline">Chưa có trang nào được dịch offline.</p>
        </div>
      </section>
    );
  }

  // Hàm tính thời gian trôi qua
  const timeAgo = (timestamp) => {
    const diff = Math.floor((new Date().getTime() - timestamp) / 1000);
    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-xs text-headline-xs text-on-surface">Trang đã dịch gần đây (Offline)</h2>
        {history.length > 3 && <button className="font-label-md text-label-md text-primary">Xem tất cả</button>}
      </div>
      <div className="space-y-2">
        {history.slice(0, 3).map((item, index) => (
          <div 
            key={index}
            onClick={() => window.open(item.url, '_blank')}
            className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 overflow-hidden shrink-0">
              {item.favIconUrl ? (
                <img alt="Favicon" className="w-6 h-6 object-contain" src={item.favIconUrl}/>
              ) : (
                <span className="material-symbols-outlined text-outline">language</span>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="font-body-md text-body-md font-semibold text-on-surface line-clamp-1" title={item.title}>{item.title}</h4>
              <p className="font-label-sm text-label-sm text-outline truncate">{timeAgo(item.timestamp)}</p>
            </div>
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="chevron_right">chevron_right</span>
          </div>
        ))}
      </div>
    </section>
  );
}
