import React, { useState, useEffect, useRef } from 'react';
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
  const [activeChapterData, setActiveChapterData] = useState(null);

  // TTS Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [playbackEngine, setPlaybackEngine] = useState('local'); // 'local' | 'cloud'
  const [selectedVoice, setSelectedVoice] = useState('');

  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  // Helper: skip to next
  const handleNextParagraph = () => {
    if (activeChapterData?.paragraphs) {
      setCurrentParagraphIndex(prev => {
        if (prev + 1 < activeChapterData.paragraphs.length) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          triggerAutoNextChapter();
          return prev;
        }
      });
    }
  };

  const triggerAutoNextChapter = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "TRIGGER_AUTO_NEXT" }, (response) => {
            console.log("[App.jsx] Triggered auto next chapter click.");
          });
        }
      });
    }
  };

  // Auto load next chapter on tab load complete
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const handleTabUpdate = (tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].id === tabId) {
              console.log("[App.jsx] Tab completed loading. Fetching next chapter clean text...");
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { action: "GET_CLEAN_TEXT" }, (response) => {
                  if (response && response.success && response.data) {
                    setActiveChapterData(response.data);
                    setCurrentParagraphIndex(0);
                    setIsPlaying(true); // Auto-play the next chapter!
                  }
                });
              }, 1200);
            }
          });
        }
      };

      chrome.tabs.onUpdated.addListener(handleTabUpdate);
      return () => {
        chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      };
    }
  }, []);

  const audioCacheRef = useRef({});
  const prefetchQueueRef = useRef(new Set());

  const clearAudioCache = () => {
    Object.values(audioCacheRef.current).forEach(audio => {
      if (audio instanceof Audio) {
        audio.pause();
      }
    });
    audioCacheRef.current = {};
    prefetchQueueRef.current.clear();
  };

  const fetchCloudAudio = async (idx, retryCount = 2) => {
    if (!activeChapterData?.paragraphs || idx >= activeChapterData.paragraphs.length) return null;
    if (audioCacheRef.current[idx]) {
      return audioCacheRef.current[idx];
    }
    const text = activeChapterData.paragraphs[idx];
    if (!text || !text.trim()) return null;

    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['settings', 'serverUrl'], async (result) => {
        const host = result.serverUrl || 'https://tienhiep.lyvuha.com';
        const settings = result.settings || {};
        
        for (let attempt = 0; attempt <= retryCount; attempt++) {
          try {
            const res = await fetch(`${host.replace(/\/$/, '')}/v1/audio/speech`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-VIP-Key': settings.vipKey || ''
              },
              body: JSON.stringify({
                input: text,
                speed: 1.0,
                vip_key: settings.vipKey || ''
              })
            });

            if (res.ok) {
              const blob = await res.blob();
              const audioUrl = URL.createObjectURL(blob);
              const audio = new Audio(audioUrl);
              audioCacheRef.current[idx] = audio;
              resolve(audio);
              return;
            } else {
              const errorText = await res.text();
              throw new Error(`TTS HTTP error status=${res.status}: ${errorText}`);
            }
          } catch (err) {
            if (attempt === retryCount) {
              reject(err);
              return;
            }
            console.warn(`[Extension TTS] Fetch attempt ${attempt} failed, retrying...`, err);
            await new Promise(r => setTimeout(r, 500));
          }
        }
      });
    });
  };

  const prefetchCloudAudio = (idx) => {
    if (!activeChapterData?.paragraphs || idx >= activeChapterData.paragraphs.length || idx < 0) return;
    if (audioCacheRef.current[idx] || prefetchQueueRef.current.has(idx)) return;

    prefetchQueueRef.current.add(idx);
    fetchCloudAudio(idx)
      .then(() => {
        prefetchQueueRef.current.delete(idx);
      })
      .catch(err => {
        console.warn(`[Extension Prefetch] Failed for paragraph ${idx}:`, err);
        prefetchQueueRef.current.delete(idx);
      });
  };

  // Initialize audio and manage window.isTtsPlaying flag
  useEffect(() => {
    clearAudioCache();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      // Reset page global flag
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => { window.isTtsPlaying = false; }
            }).catch(() => {});
          }
        });
      }
    };
  }, [activeChapterData]);

  // Set playback speed when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Main playback handler
  useEffect(() => {
    if (!isPlaying || !activeChapterData?.paragraphs || activeChapterData.paragraphs.length === 0) {
      window.speechSynthesis.pause();
      if (audioRef.current) audioRef.current.pause();
      
      // Update browser tab global TTS playing state to allow autoNext
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => { window.isTtsPlaying = false; }
            }).catch(() => {});
          }
        });
      }
      return;
    }

    // Set page global flag so browser tab autoNext doesn't trigger during play
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => { window.isTtsPlaying = true; }
          }).catch(() => {});
        }
      });
    }

    const paragraphText = activeChapterData.paragraphs[currentParagraphIndex];
    if (!paragraphText) {
      setIsPlaying(false);
      return;
    }

    if (playbackEngine === 'local') {
      if (audioRef.current) audioRef.current.pause();
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(paragraphText);
      utteranceRef.current = utterance;
      utterance.rate = playbackSpeed;
      
      if (selectedVoice) {
        const voices = window.speechSynthesis.getVoices();
        const foundVoice = voices.find(v => v.name === selectedVoice);
        if (foundVoice) utterance.voice = foundVoice;
      }

      utterance.onend = () => {
        handleNextParagraph();
      };
      utterance.onerror = (e) => {
        if (e.error !== 'interrupted') {
          console.error("Local TTS Error:", e);
          handleNextParagraph();
        }
      };

      window.speechSynthesis.speak(utterance);
    } else {
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const playParagraph = async () => {
        // Prefetch next 4 paragraphs in advance!
        for (let offset = 1; offset <= 4; offset++) {
          prefetchCloudAudio(currentParagraphIndex + offset);
        }

        let audio = audioCacheRef.current[currentParagraphIndex];
        if (!audio) {
          try {
            audio = await fetchCloudAudio(currentParagraphIndex);
          } catch (err) {
            console.error("Cloud TTS Playback failed:", err);
            setPlaybackEngine('local');
            return;
          }
        }

        if (!audio) {
          handleNextParagraph();
          return;
        }

        audioRef.current = audio;
        audio.playbackRate = playbackSpeed;

        audio.onended = () => {
          handleNextParagraph();
        };

        audio.onerror = (e) => {
          console.error("Audio playback error at paragraph", currentParagraphIndex, e);
          setPlaybackEngine('local');
        };

        audio.play()
          .then(() => {
            if (audioRef.current) audioRef.current.playbackRate = playbackSpeed;
          })
          .catch(e => {
            console.error("Audio.play() failed:", e);
            setPlaybackEngine('local');
          });
      };

      playParagraph();
    }
  }, [isPlaying, currentParagraphIndex, playbackEngine, selectedVoice, activeChapterData, playbackSpeed]);

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
          const host = result.serverUrl || (loadedSettings && loadedSettings.apiHost) || 'https://tienhiep.lyvuha.com';
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
        const host = (loadedSettings && loadedSettings.apiHost) || 'https://tienhiep.lyvuha.com';
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
      
      {currentNovelView === 'player' && (
        <NovelPlayer 
          chapterData={activeChapterData}
          onBack={() => setCurrentNovelView(null)} 
          onReadText={() => setCurrentNovelView('reader')}
          onOpenIndex={() => setCurrentNovelView('index')}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          currentParagraphIndex={currentParagraphIndex}
          setCurrentParagraphIndex={setCurrentParagraphIndex}
          playbackSpeed={playbackSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          playbackEngine={playbackEngine}
          setPlaybackEngine={setPlaybackEngine}
          selectedVoice={selectedVoice}
          setSelectedVoice={setSelectedVoice}
        />
      )}
      
      {currentNovelView === 'reader' && (
        <NovelReader 
          chapterData={activeChapterData}
          onBack={() => setCurrentNovelView('player')} 
          currentParagraphIndex={currentParagraphIndex}
          setCurrentParagraphIndex={setCurrentParagraphIndex}
        />
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
                    <DetectCurrentPage 
                      onAnalyze={handleAnalyze} 
                      onListenTTS={(data) => {
                        setActiveChapterData(data);
                        setCurrentNovelView('player');
                      }}
                    />
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
