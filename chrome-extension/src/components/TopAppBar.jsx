import React, { useState, useEffect } from 'react';

export default function TopAppBar({ mainTab, settings = {}, onOpenVipModal }) {
  const [isDark, setIsDark] = useState(false);

  // Change title based on mainTab
  let title = "Dịch Trang Web";
  let icon = "translate";
  
  if (mainTab === 'data') {
    title = "Thư Viện & Lịch Sử";
    icon = "menu_book"; 
  } else if (mainTab === 'ai') {
    title = "Trợ lý AI";
    icon = "forum";
  }

  const toggleDarkMode = () => {
    setIsDark(!isDark);
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleOpenSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('/options.html', '_blank');
    }
  };

  return (
    <header className="w-full sticky top-0 z-50 bg-surface border-b border-outline-variant flex justify-between items-center h-10 px-container-padding shrink-0 dark:bg-on-background dark:border-outline">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary dark:text-primary-fixed" data-icon={icon}>{icon}</span>
        <h1 className="font-headline-sm text-headline-sm font-bold text-primary dark:text-primary-fixed">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {/* VIP Membership Badge */}
        <button 
          onClick={onOpenVipModal}
          className={`h-7 px-2 rounded-full flex items-center gap-1 transition-all active:scale-95 text-[10px] font-bold ${
            settings.membershipType === 'vip' 
              ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400' 
              : 'bg-surface-container border border-outline-variant text-on-surface-variant'
          }`}
          title={settings.membershipType === 'vip' ? "Bạn là VIP Member" : "Nâng cấp VIP Member"}
        >
          <span className={`material-symbols-outlined text-[14px] ${settings.membershipType === 'vip' ? 'text-yellow-500' : ''}`} style={settings.membershipType === 'vip' ? { fontVariationSettings: "'FILL' 1" } : {}}>
            {settings.membershipType === 'vip' ? 'stars' : 'workspace_premium'}
          </span>
          {settings.membershipType === 'vip' ? 'VIP' : 'Standard'}
        </button>

        {mainTab === 'ai' && (
          <button 
            onClick={toggleDarkMode}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant active:scale-95 duration-100"
          >
            <span className="material-symbols-outlined text-[20px]" data-icon={isDark ? 'light_mode' : 'dark_mode'}>
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        )}
        <button 
          onClick={handleOpenSettings}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant active:scale-95 duration-100"
          title="Cài đặt đầy đủ"
        >
          <span className="material-symbols-outlined text-[20px]" data-icon="settings">settings</span>
        </button>
      </div>
    </header>
  );
}
