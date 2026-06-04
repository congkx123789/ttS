import React from 'react';

export default function BottomNavBar({ mainTab, setMainTab }) {
  const tabs = [
    { id: 'translate', icon: 'language', label: 'Dịch' },
    { id: 'auto', icon: 'smart_toy', label: 'Auto' },
    { id: 'ai', icon: 'forum', label: 'Trợ lý AI' },
    { id: 'db_search', icon: 'database', label: 'Tra cứu' },
    { id: 'data', icon: 'library_books', label: 'Tủ sách' }
  ];

  return (
    <nav className="absolute bottom-0 left-0 w-full z-50 bg-surface border-t border-outline-variant flex justify-between items-center h-[56px] px-1 pb-safe">
      {tabs.map((tab) => {
        const isActive = mainTab === tab.id;
        return (
          <button 
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center h-full px-1 hover:bg-surface-container-low transition-colors active:scale-95 duration-100 border-t-2 ${isActive ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent'}`}
          >
            <span 
              className="material-symbols-outlined mb-0.5 text-[22px]" 
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {tab.icon}
            </span>
            <span className={`font-label-sm text-[10px] ${isActive ? 'font-bold' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

