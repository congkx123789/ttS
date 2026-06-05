import React, { useState, useEffect } from 'react';

export default function LanguageSelection() {
  const [settings, setSettings] = useState({
    engineType: 'browser',
    mode: 'advanced',
    membershipType: 'standard',
    vipKey: ''
  });

  useEffect(() => {
    const loadSettings = (data) => {
      setSettings({
        engineType: data.engineType || 'browser',
        mode: data.mode || 'advanced',
        membershipType: data.membershipType || 'standard',
        vipKey: data.vipKey || ''
      });
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['settings'], (result) => {
        if (result.settings) {
          loadSettings(result.settings);
        }
      });

      const listener = (changes, areaName) => {
        if (areaName === 'local' && changes.settings) {
          loadSettings(changes.settings.newValue || {});
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    } else {
      const localSet = localStorage.getItem('settings');
      if (localSet) {
        try {
          loadSettings(JSON.parse(localSet));
        } catch (e) {}
      }
    }
  }, []);

  const updateSetting = (key, value) => {
    if (key === 'mode' && ['fast', 'advanced', 'advanced_hanviet'].includes(value)) {
      if (settings.membershipType !== 'vip') {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set({ showVipModalSignal: Date.now() });
        } else {
          localStorage.setItem('showVipModalSignal', Date.now());
          window.dispatchEvent(new Event('showVipModalSignal'));
        }
        return; // Reject mode change
      }
    }

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['settings'], (result) => {
        const currentSettings = result.settings || {};
        const updated = { ...currentSettings, [key]: value };
        chrome.storage.local.set({ settings: updated });
      });
    } else {
      try {
        const localSet = localStorage.getItem('settings');
        const currentSettings = localSet ? JSON.parse(localSet) : {};
        const updated = { ...currentSettings, [key]: value };
        localStorage.setItem('settings', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  return (
    <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant shadow-sm space-y-4">
      {/* Language Header */}
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant/50">
        <div className="flex flex-col">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Ngôn ngữ nguồn</span>
          <span className="font-title-medium text-title-medium font-bold text-on-surface flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Trung Quốc (CN)
          </span>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary shadow-sm hover:rotate-180 transition-transform duration-300 cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Ngôn ngữ đích</span>
          <span className="font-title-medium text-title-medium font-bold text-on-surface flex items-center gap-1.5 mt-0.5">
            Tiếng Việt (VN)
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </span>
        </div>
      </div>

      {/* Engine & Mode Settings */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {/* Engine Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="font-label-sm text-label-sm text-outline font-semibold uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">dns</span>
            Bộ dịch (Engine)
          </label>
          <div className="relative">
            <select
              value={settings.engineType}
              onChange={(e) => updateSetting('engineType', e.target.value)}
              className="w-full h-9 pl-3 pr-8 bg-surface border border-outline-variant rounded-lg font-body-medium text-body-medium text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 appearance-none cursor-pointer shadow-sm hover:bg-surface-container-high transition-colors"
            >
              <option value="browser">Offline (Trình duyệt)</option>
              <option value="local">Server Đám Mây (VIP)</option>
            </select>
            <span className="material-symbols-outlined text-[18px] text-outline absolute right-2 top-2 pointer-events-none">
              keyboard_arrow_down
            </span>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="font-label-sm text-label-sm text-outline font-semibold uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">tune</span>
            Chế độ dịch (Mode)
          </label>
          <div className="relative">
            <select
              value={settings.mode}
              onChange={(e) => updateSetting('mode', e.target.value)}
              className="w-full h-9 pl-3 pr-8 bg-surface border border-outline-variant rounded-lg font-body-medium text-body-medium text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 appearance-none cursor-pointer shadow-sm hover:bg-surface-container-high transition-colors"
            >
              <option value="vietphrase">Vietphrase (Local)</option>
              <option value="hanviet">Hán Việt (Local)</option>
              <option value="fast">👑 Dịch nhanh (Fast)</option>
              <option value="advanced">👑 Nâng cao (Advanced)</option>
              <option value="advanced_hanviet">👑 Nâng cao Hán-Việt</option>
            </select>
            <span className="material-symbols-outlined text-[18px] text-outline absolute right-2 top-2 pointer-events-none">
              keyboard_arrow_down
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

