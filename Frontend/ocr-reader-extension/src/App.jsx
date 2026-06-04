import React, { useState, useEffect } from 'react';
import TopAppBar from './components/TopAppBar';
import BottomNavBar from './components/BottomNavBar';
import LanguageSelection from './components/LanguageSelection';
import URLInputSection from './components/URLInputSection';
import DetectCurrentPage from './components/DetectCurrentPage';
import RecentlyTranslated from './components/RecentlyTranslated';
import SegmentedControl from './components/SegmentedControl';
import OCRScanner from './components/OCRScanner';
import ActionControls from './components/ActionControls';
import ProcessingLog from './components/ProcessingLog';
import AIAssistant from './components/AIAssistant';
import Library from './components/Library';
import AnalysisResult from './components/AnalysisResult';
import NovelPlayer from './components/NovelPlayer';
import NovelReader from './components/NovelReader';
import ChapterList from './components/ChapterList';
import Automation from './components/Automation';
import DBSearch from './components/DBSearch';
import VipUpgradeModal from './components/VipUpgradeModal';


function App() {
  const [mainTab, setMainTab] = useState('translate'); // 'translate', 'auto', 'ai', 'data'
  const [activeTab, setActiveTab] = useState('web'); // 'web' or 'ocr'
  const [analysisState, setAnalysisState] = useState('idle'); // 'idle', 'analyzing', 'success'
  const [currentNovelView, setCurrentNovelView] = useState(null); // 'player' | 'reader' | 'index' | null
  const [currentAnalysisData, setCurrentAnalysisData] = useState(null);

  // VIP Membership State
  const [settings, setSettings] = useState({
    membershipType: 'standard',
    vipKey: ''
  });
  const [showVipUpgradeModal, setShowVipUpgradeModal] = useState(false);

  const syncVipStatus = async (apiHost) => {
    if (!apiHost) return;
    try {
      const cleanedHost = apiHost.replace(/\/$/, '');
      const res = await fetch(`${cleanedHost}/api/auth/me`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.logged_in && data.user) {
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ serverUser: data.user });
          }
          const isVipOnServer = data.user.vip_status === 1;
          setSettings(prev => {
            let updated = false;
            let newMembershipType = prev.membershipType;
            let newVipKey = prev.vipKey;
            
            if (isVipOnServer && prev.membershipType !== 'vip') {
              newMembershipType = 'vip';
              newVipKey = prev.vipKey || 'VIP_SERVER';
              updated = true;
            } else if (!isVipOnServer && prev.membershipType === 'vip' && prev.vipKey === 'VIP_SERVER') {
              newMembershipType = 'standard';
              newVipKey = '';
              updated = true;
            }
            
            if (updated) {
              const newSettings = { ...prev, membershipType: newMembershipType, vipKey: newVipKey };
              if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ settings: newSettings });
              } else {
                localStorage.setItem('settings', JSON.stringify(newSettings));
              }
              return newSettings;
            }
            return prev;
          });
        }
      }
    } catch (e) {
      console.warn("Không kết nối được server để đồng bộ VIP:", e);
    }
  };

  useEffect(() => {
    const loadSettings = () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['settings', 'serverUrl'], (result) => {
          let loadedSettings = null;
          if (result.settings) {
            setSettings(prev => {
              loadedSettings = { ...prev, ...result.settings };
              return loadedSettings;
            });
          }
          const host = result.serverUrl || (loadedSettings && loadedSettings.apiHost) || 'http://localhost:5051';
          syncVipStatus(host);
        });
      } else {
        const localSet = localStorage.getItem('settings');
        let loadedSettings = null;
        if (localSet) {
          try {
            loadedSettings = JSON.parse(localSet);
            setSettings(loadedSettings);
          } catch (e) {}
        }
        const host = (loadedSettings && loadedSettings.apiHost) || 'http://localhost:5051';
        syncVipStatus(host);
      }
    };

    loadSettings();

    const checkModalSignal = () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['showVipModalSignal'], (res) => {
          if (res.showVipModalSignal) {
            setShowVipUpgradeModal(true);
            chrome.storage.local.remove(['showVipModalSignal']);
          }
        });
      }
    };
    checkModalSignal();

    if (typeof chrome !== 'undefined' && chrome.storage) {
      const listener = (changes, areaName) => {
        if (areaName === 'local') {
          if (changes.settings) {
            setSettings(changes.settings.newValue || {});
          }
          if (changes.showVipModalSignal && changes.showVipModalSignal.newValue) {
            setShowVipUpgradeModal(true);
            chrome.storage.local.remove(['showVipModalSignal']);
          }
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    } else {
      const handleSignal = () => {
        setShowVipUpgradeModal(true);
      };
      window.addEventListener('showVipModalSignal', handleSignal);
      return () => window.removeEventListener('showVipModalSignal', handleSignal);
    }
  }, []);

  const handleAnalyze = async (tabInfo, isAutoToggle = false) => {
    setCurrentAnalysisData(tabInfo);
    
    // Lưu lịch sử dịch nếu chưa đăng nhập
    if (tabInfo && tabInfo.fullUrl && typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['serverUser'], (authRes) => {
        if (!authRes.serverUser) {
          chrome.storage.local.get(['offlineTranslationHistory'], (result) => {
            let history = result.offlineTranslationHistory || [];
            history = history.filter(item => item.url !== tabInfo.fullUrl);
            history.unshift({
              title: tabInfo.title,
              url: tabInfo.fullUrl,
              favIconUrl: tabInfo.favIconUrl,
              timestamp: new Date().getTime()
            });
            if (history.length > 20) history = history.slice(0, 20);
            chrome.storage.local.set({ offlineTranslationHistory: history });
          });
        }
      });
    }

    if (isAutoToggle) {
      return;
    }

    setAnalysisState('analyzing');

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: "GET_CHAPTER_CONTENT" }, function(response) {
          if (response && response.success) {
            console.log("Đã dịch xong toàn bộ trang web!");
            setAnalysisState('success');
          } else {
            console.warn("Không dịch được dữ liệu thực tế. Chạy giả lập (fallback).");
            setTimeout(() => setAnalysisState('success'), 1500);
          }
        });
      } catch (error) {
        console.error("Lỗi khi gọi content script:", error);
        setTimeout(() => setAnalysisState('success'), 1500);
      }
    } else {
      setTimeout(() => {
        setAnalysisState('success');
      }, 1500);
    }
  };

  const handleBackToWeb = () => {
    setAnalysisState('idle');
  };

  return (
    <div className="w-[450px] h-[600px] bg-background text-on-background relative flex flex-col overflow-hidden shadow-2xl rounded-xl border border-outline-variant mx-auto">
      
      {/* Novel Views Overlays */}
      {currentNovelView === 'player' && (
        <NovelPlayer 
          onBack={() => setCurrentNovelView(null)} 
          onReadText={() => setCurrentNovelView('reader')}
          onOpenIndex={() => setCurrentNovelView('index')}
        />
      )}
      
      {currentNovelView === 'reader' && (
        <NovelReader onBack={() => setCurrentNovelView('player')} />
      )}

      {currentNovelView === 'index' && (
        <ChapterList onBack={() => setCurrentNovelView('player')} />
      )}
      
      {mainTab !== 'data' && (
        <TopAppBar 
          mainTab={mainTab} 
          settings={settings}
          onOpenVipModal={() => setShowVipUpgradeModal(true)} 
        />
      )}
      
      <main className={`flex-1 flex flex-col overflow-hidden pb-[56px]`}>
        
        {mainTab === 'translate' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-container-padding py-4 space-y-6 relative">
            
            {analysisState === 'analyzing' && (
              <div className="absolute inset-0 z-20 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center">
                <span className="material-symbols-outlined animate-spin text-[40px] text-primary mb-4">sync</span>
                <p className="font-label-md text-primary font-semibold animate-pulse">Đang phân tích trang web...</p>
              </div>
            )}

            {analysisState === 'success' ? (
              <AnalysisResult data={currentAnalysisData} onBack={handleBackToWeb} />
            ) : (
              <>
                <div className="flex bg-surface-container p-1 rounded-lg border border-outline-variant">
                  <button 
                    className={`flex-1 py-1.5 text-label-md font-label-md rounded-DEFAULT transition-all flex justify-center items-center gap-2 ${activeTab === 'web' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                    onClick={() => setActiveTab('web')}
                  >
                    <span className="material-symbols-outlined text-[16px]">language</span>
                    Dịch Web
                  </button>
                  <button 
                    className={`flex-1 py-1.5 text-label-md font-label-md rounded-DEFAULT transition-all flex justify-center items-center gap-2 ${activeTab === 'ocr' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                    onClick={() => setActiveTab('ocr')}
                  >
                    <span className="material-symbols-outlined text-[16px]">image</span>
                    Dịch Ảnh/Text
                  </button>
                </div>

                <LanguageSelection />

                {activeTab === 'web' ? (
                  <>
                    <URLInputSection />
                    <DetectCurrentPage onAnalyze={handleAnalyze} />
                    <RecentlyTranslated />
                  </>
                ) : (
                  <>
                    <SegmentedControl />
                    <OCRScanner />
                    <ActionControls />
                    <ProcessingLog />
                  </>
                )}
              </>
            )}
          </div>
        )}

        {mainTab === 'data' && (
          <div className="flex-1 overflow-hidden">
            <Library onReadNovel={() => setCurrentNovelView('player')} />
          </div>
        )}

        {mainTab === 'db_search' && (
          <div className="flex-1 overflow-hidden">
            <DBSearch />
          </div>
        )}

        {mainTab === 'ai' && (
          <div className="flex-1 overflow-hidden">
            <AIAssistant />
          </div>
        )}

        {mainTab === 'auto' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <Automation />
          </div>
        )}

      </main>

      <BottomNavBar mainTab={mainTab} setMainTab={setMainTab} />

      {/* VIP Upgrade Modal — with QR Payment & Code Activation */}
      <VipUpgradeModal
        show={showVipUpgradeModal}
        onClose={() => setShowVipUpgradeModal(false)}
        onActivated={() => {
          setSettings(prev => ({ ...prev, membershipType: 'vip' }));
        }}
      />
    </div>
  );
}

export default App;
