import React, { useState } from 'react';

export default function URLInputSection() {
  const [url, setUrl] = useState('');

  const handleTranslateUrl = () => {
    if (!url.trim()) return;
    
    // Convert to a valid URL format
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    
    // In extension context
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      // Navigate the current tab to the URL and tell it to start translating
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          // Open URL in current tab, then set a flag to auto-translate
          chrome.storage.local.set({ autoTranslateNextLoad: true }, () => {
            chrome.tabs.update(tabs[0].id, { url: targetUrl });
            window.close(); // Close popup
          });
        }
      });
    } else {
      window.location.href = targetUrl;
    }
  };

  return (
    <section className="space-y-3">
      <div className="relative">
        <input 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTranslateUrl()}
          className="w-full h-10 px-4 pr-10 rounded-lg border border-outline-variant bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-body-md font-body-md transition-all" 
          placeholder="Nhập URL trang web..." 
          type="text" 
        />
        <span className="absolute right-3 top-2.5 material-symbols-outlined text-outline text-[20px]" data-icon="link">link</span>
      </div>
      <button 
        onClick={handleTranslateUrl}
        className="w-full h-10 bg-primary text-on-primary font-headline-xs text-headline-xs rounded-lg shadow-sm hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined" data-icon="translate">translate</span>
        Dịch ngay
      </button>
    </section>
  );
}
