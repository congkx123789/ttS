import React, { useState, useEffect } from 'react';
import DBSearch from './DBSearch';

export default function OptionsApp() {
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'ai', 'dict', 'tts', 'search', 'history'
  const [settings, setSettings] = useState({
    apiHost: 'https://api.tienhiep.lyvuha.com',
    engineType: 'browser',
    mode: 'advanced',
    autoTranslate: false,
    aiModel: 'gemini-1.5-flash',
    aiKey: '',
    aiPrompt: 'Dịch đoạn văn bản tiếng Trung sau sang tiếng Việt mượt mà, văn phong truyện convert hay, giữ nguyên tên riêng Hán Việt.',
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    ttsVoice: 'vi-VN-Standard-A',
    autoPlayNext: true,
    membershipType: 'standard',
    vipKey: ''
  });

  // TTS & Reader States
  const [activeChapterData, setActiveChapterData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [playbackEngine, setPlaybackEngine] = useState('local'); // 'local' | 'cloud'
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voices, setVoices] = useState([]);
  const [fontSize, setFontSize] = useState(18); // default font size for reader
  const [readerTheme, setReaderTheme] = useState('dark'); // 'dark' | 'light' | 'sepia'
  
  // Tab tracking and TOC
  const [sourceTabId, setSourceTabId] = useState(null);
  const [tocChapters, setTocChapters] = useState([]);
  const [tocLoading, setTocLoading] = useState(false);

  const audioRef = React.useRef(null);
  const utteranceRef = React.useRef(null);

  // Search for the actual reading tab on the browser
  const searchForNovelTab = (resolve) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      if (resolve) resolve(null);
      return;
    }
    chrome.tabs.query({}, (tabs) => {
      const potentialTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome') && !t.url.startsWith('about:') && !t.url.includes(chrome.runtime.id));
      
      // Look for active tabs in other windows, or a tab matching novel domains
      let bestTab = potentialTabs.find(t => t.active);
      if (!bestTab) {
        bestTab = potentialTabs.find(t => t.url.includes('hjwzw.com') || t.url.includes('truyen') || t.url.includes('book') || t.url.includes('novel') || t.url.includes('qidian') || t.url.includes('fanqie'));
      }
      if (!bestTab && potentialTabs.length > 0) {
        bestTab = potentialTabs[0];
      }
      
      if (bestTab) {
        setSourceTabId(bestTab.id);
        if (resolve) resolve(bestTab.id);
      } else {
        if (resolve) resolve(null);
      }
    });
  };

  // Helper to send messages specifically to our novel source tab
  const sendTabMessage = (msg, callback) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    
    const send = (tabId) => {
      chrome.tabs.sendMessage(tabId, msg, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("[Options] Message target lost. Searching again...");
          searchForNovelTab((newTabId) => {
            if (newTabId) {
              chrome.tabs.sendMessage(newTabId, msg, callback);
            }
          });
        } else if (callback) {
          callback(res);
        }
      });
    };

    if (sourceTabId) {
      send(sourceTabId);
    } else {
      searchForNovelTab((newTabId) => {
        if (newTabId) {
          send(newTabId);
        }
      });
    }
  };

  // Load voices for selector
  useEffect(() => {
    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      const viVoices = available.filter(v => v.lang.startsWith('vi') || v.lang.startsWith('en'));
      setVoices(viVoices.length > 0 ? viVoices : available);
      if (viVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(viVoices[0].name);
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

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
    sendTabMessage({ action: "TRIGGER_AUTO_NEXT" }, (response) => {
      console.log("[Options] Triggered auto next chapter click.");
    });
  };

  // Sync with active tab on mount or tab changes
  const syncWithActiveTab = () => {
    sendTabMessage({ action: "GET_CLEAN_TEXT" }, (response) => {
      if (response && response.success && response.data) {
        setActiveChapterData(response.data);
        setCurrentParagraphIndex(0);
      } else {
        console.warn("Active tab returned no novel text.");
      }
    });
  };

  useEffect(() => {
    syncWithActiveTab();
  }, [activeTab]);

  // Tab updated listener (fires when page changes chapters)
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const handleTabUpdate = (tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tabId === sourceTabId) {
          console.log("[Options] Source tab navigated. Syncing new chapter...");
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: "GET_CLEAN_TEXT" }, (response) => {
              if (response && response.success && response.data) {
                setActiveChapterData(response.data);
                setCurrentParagraphIndex(0);
                setIsPlaying(true); // Resume playing next chapter immediately!
              }
            });
          }, 1200);
        }
      };
      chrome.tabs.onUpdated.addListener(handleTabUpdate);
      return () => {
        chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      };
    }
  }, [sourceTabId]);

  // Fetch Table Of Contents (Mục Lục) dynamically
  useEffect(() => {
    if (!activeChapterData?.tocUrl) {
      setTocChapters([]);
      return;
    }
    
    const fetchTOC = async () => {
      setTocLoading(true);
      try {
        console.log("[TOC] Fetching table of contents from:", activeChapterData.tocUrl);
        const res = await fetch(activeChapterData.tocUrl);
        if (res.ok) {
          const html = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          const anchors = Array.from(doc.querySelectorAll('a'));
          const chapters = [];
          const seenUrls = new Set();
          
          anchors.forEach(a => {
            const href = a.getAttribute('href');
            if (!href) return;
            const text = a.textContent.trim();
            
            let fullUrl = href;
            if (href.startsWith('//')) {
              fullUrl = 'https:' + href;
            } else if (href.startsWith('/')) {
              const urlObj = new URL(activeChapterData.tocUrl);
              fullUrl = urlObj.origin + href;
            } else if (!href.startsWith('http')) {
              const urlObj = new URL(activeChapterData.tocUrl);
              const pathParts = urlObj.pathname.split('/');
              pathParts.pop();
              fullUrl = urlObj.origin + pathParts.join('/') + '/' + href;
            }
            
            if (seenUrls.has(fullUrl)) return;
            
            // Filter chapter links
            const isChap = /第\s*\d+\s*[章回节]/.test(text) || 
                           /Chương\s*\d+/.test(text) || 
                           (text && /^\d+/.test(text) && text.length < 50) ||
                           (fullUrl.includes('/Read/') && text.length > 2 && text.length < 60);
                           
            if (isChap && text.length > 2) {
              chapters.push({ title: text, url: fullUrl });
              seenUrls.add(fullUrl);
            }
          });
          
          console.log(`[TOC] Parsed ${chapters.length} chapters.`);
          setTocChapters(chapters);
        }
      } catch (e) {
        console.error("[TOC] Failed to fetch TOC:", e);
      } finally {
        setTocLoading(false);
      }
    };
    
    fetchTOC();
  }, [activeChapterData?.tocUrl]);

  // Audio setup
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      handleNextParagraph();
    };
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
    };
  }, [activeChapterData]);

  // Handle TTS play
  useEffect(() => {
    if (!isPlaying || !activeChapterData?.paragraphs || activeChapterData.paragraphs.length === 0) {
      window.speechSynthesis.pause();
      if (audioRef.current) audioRef.current.pause();
      return;
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
        const voicesList = window.speechSynthesis.getVoices();
        const foundVoice = voicesList.find(v => v.name === selectedVoice);
        if (foundVoice) utterance.voice = foundVoice;
      }

      utterance.onend = () => {
        handleNextParagraph();
      };
      utterance.onerror = (e) => {
        if (e.error !== 'interrupted') {
          console.error("Local TTS Error options:", e);
          handleNextParagraph();
        }
      };

      window.speechSynthesis.speak(utterance);
    } else {
      window.speechSynthesis.cancel();
      if (audioRef.current) audioRef.current.pause();

      const fetchCloudTTS = async () => {
        try {
          const host = settings.apiHost || 'https://api-tienhiep.lyvuha.com';
          const cleanedHost = host.replace(/\/$/, '');
          const res = await fetch(`${cleanedHost}/v1/audio/speech`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-VIP-Key': settings.vipKey || ''
            },
            body: JSON.stringify({
              input: paragraphText,
              speed: playbackSpeed,
              vip_key: settings.vipKey || ''
            })
          });
          
          if (res.ok) {
            const blob = await res.blob();
            const audioUrl = URL.createObjectURL(blob);
            if (audioRef.current) {
              audioRef.current.src = audioUrl;
              audioRef.current.playbackRate = playbackSpeed;
              audioRef.current.play().catch(e => {
                console.error("Cloud audio options failed:", e);
                setPlaybackEngine('local');
              });
            }
          } else {
            setPlaybackEngine('local');
          }
        } catch (err) {
          console.error("Cloud TTS failed:", err);
          setPlaybackEngine('local');
        }
      };

      fetchCloudTTS();
    }
  }, [isPlaying, currentParagraphIndex, playbackEngine, selectedVoice, activeChapterData, playbackSpeed]);

  // Helper to dynamically get EPUB host mapped from settings.apiHost
  const getEpubHost = () => {
    const host = (settings.apiHost || 'https://api.tienhiep.lyvuha.com').replace(/\/$/, '');
    if (host.includes('dich.lyvuha.com')) {
      return host.replace('dich.lyvuha.com', 'tienhiep.lyvuha.com');
    }
    if (host.includes('localhost:5050')) {
      return host.replace('localhost:5050', 'localhost:5051');
    }
    if (host.includes('127.0.0.1:5050')) {
      return host.replace('127.0.0.1:5050', '127.0.0.1:5051');
    }
    return host;
  };
  
  const handleActivateVip = (code) => {
    const validCodes = ["VIP2026", "ANTIGRAVITY", "PREMIUM_MEMBER", "VIP_TRANSLATOR"];
    if (validCodes.includes(code.trim().toUpperCase())) {
      updateSetting('membershipType', 'vip');
      updateSetting('vipKey', code.trim().toUpperCase());
      alert("Chúc mừng! Bạn đã kích hoạt thành công tài khoản VIP Member 👑");
      return true;
    } else {
      alert("Mã kích hoạt không đúng. Vui lòng thử lại!");
      return false;
    }
  };
  
  const [history, setHistory] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');

  // VIP EPUB States
  const [epubSubTab, setEpubSubTab] = useState('translate'); // 'translate', 'convert', 'optimize'
  const [epubFile, setEpubFile] = useState(null);
  const [epubMode, setEpubMode] = useState('fast');
  const [epubLimit, setEpubLimit] = useState(-1);
  const [epubCleanStyles, setEpubCleanStyles] = useState(true);
  const [epubStripImages, setEpubStripImages] = useState(false);
  const [epubStripFonts, setEpubStripFonts] = useState(false);
  const [epubCustomDict, setEpubCustomDict] = useState('');
  const [epubLoading, setEpubLoading] = useState(false);
  const [epubStatus, setEpubStatus] = useState('');

  // Convert TXT states
  const [txtTitle, setTxtTitle] = useState('');
  const [txtAuthor, setTxtAuthor] = useState('');
  const [txtDesc, setTxtDesc] = useState('');
  const [txtRegex, setTxtRegex] = useState('第\\s*\\d+\\s*[章|回|节]');
  const [txtFile, setTxtFile] = useState(null);
  const [txtPaste, setTxtPaste] = useState('');
  const [txtTranslate, setTxtTranslate] = useState(false);

  const handleEpubTranslate = async (e) => {
    e.preventDefault();
    if (!epubFile) {
      alert("Vui lòng chọn file EPUB cần dịch!");
      return;
    }
    setEpubLoading(true);
    setEpubStatus('Đang tải file lên và dịch... Vui lòng không đóng tab này.');
    const formData = new FormData();
    formData.append('file', epubFile);
    formData.append('mode', epubMode);
    formData.append('limit_chapters', epubLimit);
    formData.append('clean_styles', epubCleanStyles);
    formData.append('strip_images', epubStripImages);
    formData.append('strip_fonts', epubStripFonts);
    formData.append('custom_dict', epubCustomDict);

    try {
      const epubHost = getEpubHost();
      const fetchHeaders = {};
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const authRes = await new Promise(resolve => chrome.storage.local.get(['serverAuthToken'], resolve));
        if (authRes.serverAuthToken) fetchHeaders['Authorization'] = `Bearer ${authRes.serverAuthToken}`;
      }
      fetchHeaders['X-VIP-Key'] = settings.vipKey || '';

      const response = await fetch(`${epubHost}/api/epub/translate`, {
        method: 'POST',
        body: formData,
        headers: fetchHeaders
      });
      if (!response.ok) {
        const errorText = await response.json();
        throw new Error(errorText.error || 'Dịch EPUB thất bại');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${epubFile.name.replace('.epub', '')}_Dich_${epubMode}.epub`;
      if (contentDisposition) {
        const parts = contentDisposition.split('filename=');
        if (parts.length > 1) {
          filename = parts[1].replace(/"/g, '').trim();
        }
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Đã tải xuống sách EPUB đã dịch thành công!');
      setEpubStatus('');
    } catch (err) {
      alert(err.message);
      setEpubStatus('Lỗi: ' + err.message);
    } finally {
      setEpubLoading(false);
    }
  };

  const handleEpubConvertTxt = async (e) => {
    e.preventDefault();
    if (!txtFile && !txtPaste) {
      alert("Vui lòng chọn file TXT hoặc dán nội dung văn bản!");
      return;
    }
    if (!txtTitle) {
      alert("Vui lòng nhập tên truyện!");
      return;
    }
    setEpubLoading(true);
    setEpubStatus('Đang chuyển đổi và đóng gói EPUB...');
    const formData = new FormData();
    if (txtFile) {
      formData.append('file', txtFile);
    } else {
      formData.append('text', txtPaste);
    }
    formData.append('title', txtTitle);
    formData.append('author', txtAuthor || 'Vô danh');
    formData.append('description', txtDesc);
    formData.append('split_regex', txtRegex);
    formData.append('translate', txtTranslate);
    formData.append('mode', epubMode);
    formData.append('custom_dict', epubCustomDict);

    try {
      const epubHost = getEpubHost();
      const fetchHeaders = {};
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const authRes = await new Promise(resolve => chrome.storage.local.get(['serverAuthToken'], resolve));
        if (authRes.serverAuthToken) fetchHeaders['Authorization'] = `Bearer ${authRes.serverAuthToken}`;
      }
      fetchHeaders['X-VIP-Key'] = settings.vipKey || '';

      const response = await fetch(`${epubHost}/api/epub/convert-txt`, {
        method: 'POST',
        body: formData,
        headers: fetchHeaders
      });
      if (!response.ok) {
        const errorText = await response.json();
        throw new Error(errorText.error || 'Tạo file EPUB thất bại');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${txtTitle}.epub`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Tạo file EPUB thành công!');
      setEpubStatus('');
    } catch (err) {
      alert(err.message);
      setEpubStatus('Lỗi: ' + err.message);
    } finally {
      setEpubLoading(false);
    }
  };

  const handleEpubOptimize = async (e) => {
    e.preventDefault();
    if (!epubFile) {
      alert("Vui lòng chọn file EPUB cần tối ưu!");
      return;
    }
    setEpubLoading(true);
    setEpubStatus('Đang tối ưu cấu trúc và loại bỏ tệp tin rác...');
    const formData = new FormData();
    formData.append('file', epubFile);
    formData.append('strip_images', epubStripImages);
    formData.append('strip_fonts', epubStripFonts);

    try {
      const epubHost = getEpubHost();
      const fetchHeaders = {};
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const authRes = await new Promise(resolve => chrome.storage.local.get(['serverAuthToken'], resolve));
        if (authRes.serverAuthToken) fetchHeaders['Authorization'] = `Bearer ${authRes.serverAuthToken}`;
      }
      fetchHeaders['X-VIP-Key'] = settings.vipKey || '';

      const response = await fetch(`${epubHost}/api/epub/optimize`, {
        method: 'POST',
        body: formData,
        headers: fetchHeaders
      });
      if (!response.ok) {
        const errorText = await response.json();
        throw new Error(errorText.error || 'Tối ưu EPUB thất bại');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${epubFile.name.replace('.epub', '')}_Optimized.epub`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Tối ưu hóa EPUB thành công!');
      setEpubStatus('');
    } catch (err) {
      alert(err.message);
      setEpubStatus('Lỗi: ' + err.message);
    } finally {
      setEpubLoading(false);
    }
  };


  const syncVipStatus = async (apiHost) => {
    if (!apiHost) return;
    try {
      const cleanedHost = apiHost.replace(/\/$/, '');
      let token = '';
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const res = await new Promise(resolve => chrome.storage.local.get(['serverAuthToken'], resolve));
        token = res.serverAuthToken;
      }
      const headers = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const res = await fetch(`${cleanedHost}/api/auth/me`, {
        method: 'GET',
        headers,
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

  // Load settings from chrome.storage.local on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['settings', 'offlineTranslationHistory', 'serverUrl'], (result) => {
        let loadedSettings = null;
        if (result.settings) {
          setSettings(prev => {
            loadedSettings = { ...prev, ...result.settings };
            return loadedSettings;
          });
        }
        if (result.offlineTranslationHistory) {
          setHistory(result.offlineTranslationHistory);
        }
        const host = result.serverUrl || (loadedSettings && loadedSettings.apiHost) || 'https://api-tienhiep.lyvuha.com';
        syncVipStatus(host);
      });
    } else {
      // Dev/fallback mode
      const localSet = localStorage.getItem('settings');
      let loadedSettings = null;
      if (localSet) {
        try {
          loadedSettings = JSON.parse(localSet);
          setSettings(loadedSettings);
        } catch (e) {}
      }
      setHistory([
        { title: 'Khai Cục Trưởng Sinh Vạn Cổ', url: 'https://faloo.com/1234.html', timestamp: Date.now() - 3600000 },
        { title: 'Hệ Thống Phú Ngã Trưởng Sinh', url: 'https://qidian.com/5678.html', timestamp: Date.now() - 7200000 }
      ]);
      const host = (loadedSettings && loadedSettings.apiHost) || 'https://api-tienhiep.lyvuha.com';
      syncVipStatus(host);
    }
  }, []);

  // Save settings helper
  const updateSetting = (key, value) => {
    if (key === 'mode' && ['fast', 'advanced', 'advanced_hanviet'].includes(value)) {
      if (settings.membershipType !== 'vip') {
        alert("Chế độ dịch máy chủ nâng cao yêu cầu tài khoản VIP Member. Vui lòng kích hoạt VIP.");
        return;
      }
    }

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ settings: newSettings }, () => {
        showToast('Đã lưu cấu hình tự động');
      });
    } else {
      localStorage.setItem('settings', JSON.stringify(newSettings));
      showToast('Đã lưu cấu hình (Local Dev)');
    }
  };

  const showToast = (msg) => {
    setSaveStatus(msg);
    setTimeout(() => {
      setSaveStatus('');
    }, 2000);
  };

  const clearHistory = () => {
    if (window.confirm("Bạn có chắc muốn xóa lịch sử dịch không?")) {
      setHistory([]);
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.remove(['offlineTranslationHistory']);
      }
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* SIDEBAR (Dark Premium Navigation) */}
      <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 border-b border-gray-800 flex items-center gap-3">
            <span className="material-symbols-outlined text-yellow-500 text-3xl">translate</span>
            <div className="flex flex-col">
              <span className="text-white font-extrabold text-sm tracking-widest uppercase">TRANSLATOR</span>
              <span className="text-[10px] text-gray-500 font-semibold uppercase">Premium Dashboard</span>
            </div>
          </div>

          {/* Upgrade Banner Button */}
          <div className="px-4 py-3">
            {settings.membershipType === 'vip' ? (
              <button 
                disabled
                className="w-full py-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-gray-950 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/20"
              >
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                👑 VIP Member 👑
              </button>
            ) : (
              <button 
                onClick={() => {
                  const code = prompt("Nhập mã kích hoạt VIP (Mặc định dùng thử: VIP2026):");
                  if (code) {
                    handleActivateVip(code);
                  }
                }}
                className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 active:scale-95 transition-all text-gray-950 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-yellow-500/10 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
                Kích hoạt VIP Member
              </button>
            )}
          </div>

          {/* Menu Items */}
          <nav className="px-3 mt-4 space-y-1">
            {[
              { id: 'general', label: 'Cài đặt chung', icon: 'settings' },
              { id: 'reader', label: 'Đọc truyện & TTS', icon: 'menu_book' },
              { id: 'epub', label: 'Công cụ EPUB (VIP)', icon: 'auto_stories' },
              { id: 'ai', label: 'Trợ lý AI Config', icon: 'forum' },
              { id: 'search', label: 'Tra cứu Database', icon: 'search' },
              { id: 'tts', label: 'Giọng đọc & Audio', icon: 'volume_up' },
              { id: 'history', label: 'Lịch sử & Thống kê', icon: 'history' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full py-2.5 px-4 rounded-lg flex items-center gap-3 text-xs font-bold transition-all ${
                  activeTab === item.id 
                    ? 'bg-gray-800 text-white shadow-inner border-l-4 border-yellow-500' 
                    : 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${activeTab === item.id ? 'text-yellow-500' : 'text-gray-500'}`}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer Sidebar with App promo */}
        <div className="p-4 border-t border-gray-800 flex flex-col items-center">
          <div className="bg-white p-1 rounded-lg shadow-md mb-2">
            {/* Mockup QR Code */}
            <div className="w-24 h-24 bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-mono select-none">
              QR CODE
            </div>
          </div>
          <span className="text-[10px] text-gray-500 font-semibold">Tải Offline Novel App</span>
          <span className="text-[9px] text-gray-600 mt-0.5">Android & iOS</span>
        </div>
      </aside>

      {/* CONTENT PANEL */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Floating Toast Notification */}
        {saveStatus && (
          <div className="absolute top-4 right-4 z-50 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border border-gray-800 animate-fade-in-down">
            <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
            {saveStatus}
          </div>
        )}

        {/* Sub-Header Title */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 select-none">
          <h2 className="text-lg font-extrabold text-gray-800 uppercase tracking-wide">
            {activeTab === 'general' && 'Cấu hình Chung'}
            {activeTab === 'reader' && 'Trình Đọc Truyện & Nghe Nhạc AI'}
            {activeTab === 'epub' && 'Hộp công cụ EPUB VIP'}
            {activeTab === 'ai' && 'Cấu hình Trợ Lý AI'}
            {activeTab === 'search' && 'Tra cứu Cơ Sở Dữ Liệu Sách'}
            {activeTab === 'tts' && 'Cấu hình Giọng đọc TTS'}
            {activeTab === 'history' && 'Lịch sử sử dụng'}
          </h2>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-ping"></span>
            <span className="text-xs text-gray-500 font-semibold uppercase">API Local Connected</span>
          </div>
        </header>

        {/* Body content scroll area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          
          {/* TAB 1: GENERAL SETTINGS */}
          {activeTab === 'general' && (
            <div className="max-w-3xl space-y-6">
              
              {/* Card Quyền thành viên */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-yellow-500" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                  Quyền thành viên (Membership Status)
                </h3>
                <p className="text-xs text-gray-500">
                  Quản lý gói tài khoản của bạn để mở khóa các tính năng dịch cao cấp.
                </p>
                {settings.membershipType === 'vip' ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">👑</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-extrabold text-yellow-800 uppercase tracking-wider">Tài khoản VIP Member</span>
                        <span className="text-[10px] text-yellow-600 font-medium">Đã kích hoạt bằng mã: <span className="font-mono font-bold">{settings.vipKey}</span></span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        updateSetting('membershipType', 'standard');
                        updateSetting('vipKey', '');
                        alert("Đã hủy trạng thái VIP. Tài khoản chuyển về Standard.");
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Hủy VIP
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 uppercase">Gói hiện tại: Standard Member</span>
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold uppercase">Miễn phí</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-normal">
                      Bạn đang sử dụng gói Standard. Các chế độ dịch nâng cao qua server (Fast, Advanced, Advanced Hán-Việt) và Trợ lý AI đang bị khóa.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <input 
                        type="text"
                        placeholder="Nhập mã kích hoạt VIP (ví dụ: VIP2026)"
                        id="vip_code_options_input"
                        className="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-xs outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20 font-mono text-center uppercase tracking-widest"
                      />
                      <button 
                        onClick={() => {
                          const inputVal = document.getElementById('vip_code_options_input')?.value || '';
                          handleActivateVip(inputVal);
                        }}
                        className="h-9 px-4 bg-yellow-500 hover:bg-yellow-600 text-gray-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Kích hoạt
                      </button>
                    </div>
                    <p className="text-[9px] text-outline">
                      * Nhập mã <span className="font-bold">VIP2026</span> hoặc <span className="font-bold">ANTIGRAVITY</span> để dùng thử VIP miễn phí.
                    </p>
                  </div>
                )}
              </div>

              {/* Card Engine Dịch thuật */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">translate</span>
                  Nguồn dịch thuật (Translation Engine)
                </h3>
                <p className="text-xs text-gray-500">
                  Chọn phương thức kết nối để dịch thuật chữ trong ảnh hoặc văn bản.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { id: 'browser', label: 'Offline (Trình duyệt)', desc: 'Tự chạy 100% trên Chrome, không cần Server Python.' },
                    { id: 'local', label: 'Python Server (Cục bộ)', desc: 'Kết nối localhost:5000, hỗ trợ dịch nâng cao và sách EPUB.' }
                  ].map(engine => (
                    <button
                      key={engine.id}
                      onClick={() => updateSetting('engineType', engine.id)}
                      className={`p-3 text-left rounded-lg border flex flex-col justify-between transition-all ${
                        (settings.engineType || 'browser') === engine.id 
                          ? 'border-yellow-500 bg-yellow-500/5 ring-1 ring-yellow-500' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xs font-extrabold text-gray-800">{engine.label}</span>
                      <span className="text-[10px] text-gray-500 mt-1">{engine.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Host API (chỉ hiển thị khi dùng Python Server) */}
              {(settings.engineType === 'local') && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">dns</span>
                    Địa chỉ Server Localhost
                  </h3>
                  <p className="text-xs text-gray-500">
                    Extension cần kết nối tới Server Python Flask cục bộ để truy vấn database và thực hiện dịch nhanh.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settings.apiHost}
                      onChange={(e) => updateSetting('apiHost', e.target.value)}
                      placeholder="https://api-tienhiep.lyvuha.com"
                      className="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-xs outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/20"
                    />
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch(`${settings.apiHost}/api/stats`);
                          if (res.ok) alert("Kết nối thành công tới Server!");
                          else alert("Server phản hồi nhưng có lỗi!");
                        } catch {
                          alert("Không kết nối được Server. Hãy kiểm tra dịch vụ!");
                        }
                      }}
                      className="h-9 px-4 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Kiểm tra
                    </button>
                  </div>
                </div>
              )}

              {/* Card Dịch tự động */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  Tính năng & Chế độ Dịch
                </h3>
                
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800">Tự động dịch web (Auto-translate)</span>
                    <span className="text-[11px] text-gray-500">Tự động phát hiện tiếng Trung và dịch khi tải xong trang web.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={settings.autoTranslate}
                      onChange={(e) => updateSetting('autoTranslate', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-gray-800">Chế độ hiển thị bản dịch mặc định</span>
                  <span className="text-[11px] text-gray-500">Cấu hình chế độ bóc tách text sang file database hiện hành.</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    {[
                      { id: 'vietphrase', label: 'Vietphrase (Local)', desc: 'Dịch Vietphrase offline không cần mạng', engine: 'Local' },
                      { id: 'hanviet', label: 'Hán Việt (Local)', desc: 'Bản dịch âm Hán Việt thô offline', engine: 'Local' },
                      { id: 'fast', label: 'Dịch nhanh (Fast)', desc: 'Tối ưu tốc độ qua Python Server', engine: 'Server' },
                      { id: 'advanced', label: 'Nâng cao (Advanced)', desc: 'Bản dịch chất lượng cao qua Server', engine: 'Server' },
                      { id: 'advanced_hanviet', label: 'Nâng cao Hán-Việt', desc: 'Dịch Hán-Việt chất lượng cao qua Server', engine: 'Server' }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => updateSetting('mode', mode.id)}
                        className={`p-4 text-left rounded-xl border flex flex-col justify-between transition-all relative overflow-hidden ${
                          settings.mode === mode.id 
                            ? 'border-yellow-500 bg-yellow-500/5 ring-1 ring-yellow-500' 
                            : 'border-gray-200 hover:border-gray-300 bg-gray-50/50 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="text-xs font-extrabold text-gray-800">{mode.label}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                            mode.engine === 'Local' 
                              ? 'bg-green-100 text-green-700 border border-green-200' 
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {mode.engine}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 mt-2 font-medium leading-relaxed">{mode.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB: FULL-SCREEN NOVEL READER & TTS PLAYBACK */}
          {activeTab === 'reader' && (
            <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-6 h-[calc(100vh-170px)] overflow-hidden animate-fade-in">
              {/* Left Sidebar: Controls & Info */}
              <div className="w-full lg:w-80 shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                <div className="space-y-5">
                  {/* Novel Cover & Title */}
                  <div className="flex flex-col items-center text-center space-y-3 pb-3 border-b border-gray-100">
                    {activeChapterData?.cover ? (
                      <img 
                        src={activeChapterData.cover} 
                        alt="Book Cover" 
                        className="w-24 aspect-[3/4] object-cover rounded-lg shadow-md border border-gray-100 animate-fade-in" 
                      />
                    ) : (
                      <div className="w-24 aspect-[3/4] bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex flex-col justify-between p-3 text-center text-white border border-gray-600 shadow-md">
                        <span className="text-[8px] font-bold tracking-widest text-yellow-500 uppercase">Antigravity</span>
                        <span className="material-symbols-outlined text-3xl text-gray-400 self-center">menu_book</span>
                        <span className="text-[8px] text-gray-400 font-semibold truncate">{activeChapterData?.author || 'Tác giả ẩn'}</span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs font-extrabold text-gray-800 line-clamp-1">{activeChapterData?.novelTitle || 'Truyện Ngoài'}</h3>
                      <p className="text-[11px] font-bold text-yellow-600 mt-0.5 line-clamp-1">{activeChapterData?.chapterTitle || 'Chưa chọn chương'}</p>
                    </div>
                  </div>

                  {/* Sync Action */}
                  <div className="space-y-1.5">
                    <button 
                      onClick={syncWithActiveTab}
                      className="w-full h-9 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-gray-900/10 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[16px]">sync</span>
                      Đồng bộ từ Trình duyệt
                    </button>
                    <p className="text-[9px] text-gray-400 leading-normal text-center">
                      * Bắt buộc click khi đổi tab đọc trên Chrome để nhận diện trang.
                    </p>
                  </div>

                  {/* Settings section */}
                  <div className="space-y-2.5 pt-1 border-t border-gray-100">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Cấu hình hiển thị</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'dark', label: 'Tối', bg: 'bg-gray-900 border-gray-800 text-white' },
                        { id: 'sepia', label: 'Giấy', bg: 'bg-[#f4ecd8] border-[#e2d5b6] text-amber-950' },
                        { id: 'light', label: 'Sáng', bg: 'bg-white border-gray-200 text-gray-800' }
                      ].map(theme => (
                        <button
                          key={theme.id}
                          onClick={() => setReaderTheme(theme.id)}
                          className={`py-1 px-1.5 rounded-lg border text-[10px] font-bold transition-all text-center cursor-pointer ${
                            readerTheme === theme.id 
                              ? 'ring-2 ring-yellow-500 font-extrabold scale-[1.03]' 
                              : 'opacity-70 hover:opacity-100'
                          } ${theme.bg}`}
                        >
                          {theme.label}
                        </button>
                      ))}
                    </div>

                    {/* Font size control */}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-xs font-semibold text-gray-700">Cỡ chữ</span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setFontSize(prev => Math.max(12, prev - 1))}
                          className="h-6 w-6 bg-gray-100 hover:bg-gray-200 active:scale-90 rounded flex items-center justify-center text-[10px] font-bold text-gray-700 cursor-pointer"
                        >
                          A-
                        </button>
                        <span className="text-[11px] font-bold w-7 text-center text-gray-800">{fontSize}px</span>
                        <button 
                          onClick={() => setFontSize(prev => Math.min(32, prev + 1))}
                          className="h-6 w-6 bg-gray-100 hover:bg-gray-200 active:scale-90 rounded flex items-center justify-center text-[10px] font-bold text-gray-700 cursor-pointer"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Navigation controls */}
                  <div className="space-y-2 pt-1 border-t border-gray-100">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Chuyển chương nhanh</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => {
                          sendTabMessage({ action: "TRIGGER_PREV" });
                        }}
                        className="py-1.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 active:scale-95 rounded-lg text-xs font-bold text-gray-700 flex items-center justify-center gap-0.5 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">navigate_before</span>
                        Chương Trước
                      </button>
                      <button 
                        onClick={triggerAutoNextChapter}
                        className="py-1.5 bg-yellow-500 hover:bg-yellow-600 active:scale-95 rounded-lg text-xs font-bold text-gray-950 flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-sm shadow-yellow-500/10"
                      >
                        Chương Sau
                        <span className="material-symbols-outlined text-[16px]">navigate_next</span>
                      </button>
                    </div>
                  </div>

                  {/* Table of Contents Section */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider flex items-center justify-between">
                      Mục lục chương
                      {tocChapters.length > 0 && (
                        <span className="bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          {tocChapters.length} chương
                        </span>
                      )}
                    </span>
                    {tocLoading ? (
                      <div className="flex items-center justify-center py-6 gap-2">
                        <span className="animate-spin h-4 w-4 border-2 border-yellow-500 border-t-transparent rounded-full"></span>
                        <span className="text-xs text-gray-400 font-medium">Đang tải mục lục...</span>
                      </div>
                    ) : tocChapters.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-1.5 space-y-1 bg-gray-50/50 custom-scrollbar text-xs">
                        {tocChapters.map((chap, index) => {
                          // Simple check: if chapter title from tab contains chap.title or matches
                          const isCurrent = activeChapterData?.chapterTitle && 
                                            (activeChapterData.chapterTitle.includes(chap.title) || 
                                             chap.title.includes(activeChapterData.chapterTitle.replace(/第\s*\d+\s*[章页].*$/, '').trim()));
                          
                          return (
                            <button
                              key={index}
                              onClick={() => {
                                if (typeof chrome !== 'undefined' && chrome.tabs && sourceTabId) {
                                  chrome.tabs.update(sourceTabId, { url: chap.url, active: true });
                                }
                              }}
                              className={`w-full text-left py-1.5 px-2 rounded transition-all truncate block cursor-pointer text-[11px] ${
                                isCurrent 
                                  ? 'bg-yellow-500/15 text-yellow-700 font-extrabold border-l-2 border-yellow-500' 
                                  : 'hover:bg-gray-100 text-gray-600'
                              }`}
                              title={chap.title}
                            >
                              {chap.title}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 leading-relaxed px-2">
                        Chưa nhận diện được mục lục. Nhấn "Đồng bộ từ Trình duyệt" khi ở tab đọc truyện để nhận diện.
                      </p>
                    )}
                  </div>

                </div>

                {/* Info footer */}
                <div className="pt-3 border-t border-gray-100 text-center">
                  <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider block">Trình phát nhạc rảnh tay</span>
                </div>
              </div>

              {/* Right Panel: Reading Board & Audio Playback */}
              <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between">
                
                {/* Reading Canvas */}
                <div className={`flex-1 overflow-y-auto p-8 custom-scrollbar ${
                  readerTheme === 'dark' ? 'bg-[#18181a] text-[#e3e3e6]' :
                  readerTheme === 'sepia' ? 'bg-[#faf6eb] text-[#433422]' :
                  'bg-[#fcfcfc] text-[#1c1c1e]'
                }`}>
                  {!activeChapterData || !activeChapterData.paragraphs?.length ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                      <span className="material-symbols-outlined text-5xl text-gray-400 animate-pulse">menu_book</span>
                      <h4 className="text-sm font-bold text-gray-700">Chưa có nội dung truyện để hiển thị</h4>
                      <p className="text-xs text-gray-500 max-w-sm leading-relaxed text-center">
                        Hãy mở tab truyện chữ cần đọc trên trình duyệt (ví dụ: hjwzw.com, truyenfull, v.v.), sau đó nhấn nút "Đồng bộ từ Trình duyệt" ở cột bên trái để tải chữ vào đây.
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-2xl mx-auto space-y-6 select-text leading-relaxed font-merriweather" style={{ fontSize: `${fontSize}px` }}>
                      <h1 className="text-xl md:text-2xl font-bold font-sans text-center mb-8 border-b pb-4 opacity-90" style={{ borderBottomColor: readerTheme === 'dark' ? '#2e2e30' : readerTheme === 'sepia' ? '#ebdcb9' : '#e5e7eb' }}>
                        {activeChapterData.chapterTitle}
                      </h1>
                      {activeChapterData.paragraphs.map((para, idx) => (
                        <p 
                          key={idx}
                          onClick={() => setCurrentParagraphIndex(idx)}
                          className={`cursor-pointer px-3 py-2.5 rounded-lg transition-all ${
                            currentParagraphIndex === idx 
                              ? 'bg-yellow-500/20 ring-1 ring-yellow-500 font-medium' 
                              : 'hover:bg-yellow-500/5'
                          }`}
                        >
                          {para}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Control Bar */}
                <div className="h-20 bg-gray-950 text-white border-t border-gray-800 px-6 flex items-center justify-between shrink-0 select-none">
                  {/* Left: Playback Info */}
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Đang phát (TTS)</span>
                      <span className="text-xs font-semibold text-white line-clamp-1 max-w-[180px]">
                        {activeChapterData?.paragraphs?.[currentParagraphIndex] || 'Không có âm thanh.'}
                      </span>
                    </div>
                  </div>

                  {/* Center: Play/Pause controls */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setCurrentParagraphIndex(prev => Math.max(0, prev - 1))}
                        disabled={!activeChapterData}
                        className="material-symbols-outlined text-white hover:text-yellow-500 disabled:opacity-50 text-2xl transition-colors cursor-pointer"
                      >
                        skip_previous
                      </button>
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        disabled={!activeChapterData}
                        className="h-10 w-10 bg-yellow-500 hover:bg-yellow-600 active:scale-95 text-gray-950 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-2xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {isPlaying ? 'pause' : 'play_arrow'}
                        </span>
                      </button>
                      <button 
                        onClick={handleNextParagraph}
                        disabled={!activeChapterData}
                        className="material-symbols-outlined text-white hover:text-yellow-500 disabled:opacity-50 text-2xl transition-colors cursor-pointer"
                      >
                        skip_next
                      </button>
                    </div>
                    {activeChapterData && (
                      <span className="text-[10px] text-gray-400 font-mono">
                        Đoạn {currentParagraphIndex + 1} / {activeChapterData.paragraphs.length}
                      </span>
                    )}
                  </div>

                  {/* Right: Audio options (Engine, Speed, Voice) */}
                  <div className="flex items-center gap-4 min-w-[250px] justify-end">
                    <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-lg border border-gray-700">
                      <span className="material-symbols-outlined text-gray-400 text-sm">speed</span>
                      <select 
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                        className="bg-transparent text-xs text-white outline-none font-bold cursor-pointer"
                      >
                        <option value="0.75" className="bg-gray-800 text-white">0.75x</option>
                        <option value="1.0" className="bg-gray-800 text-white">1.0x</option>
                        <option value="1.25" className="bg-gray-800 text-white">1.25x</option>
                        <option value="1.5" className="bg-gray-800 text-white">1.5x</option>
                        <option value="1.75" className="bg-gray-800 text-white">1.75x</option>
                        <option value="2.0" className="bg-gray-800 text-white">2.0x</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-lg border border-gray-700">
                      <span className="material-symbols-outlined text-gray-400 text-sm">settings_voice</span>
                      <select 
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="bg-transparent text-xs text-white outline-none font-bold max-w-[100px] truncate cursor-pointer"
                      >
                        {voices.map((v, i) => (
                          <option key={i} value={v.name} className="bg-gray-800 text-white">{v.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-lg border border-gray-700">
                      <span className="material-symbols-outlined text-gray-400 text-sm">dns</span>
                      <select 
                        value={playbackEngine}
                        onChange={(e) => setPlaybackEngine(e.target.value)}
                        className="bg-transparent text-xs text-white outline-none font-bold cursor-pointer"
                      >
                        <option value="local" className="bg-gray-800 text-white">Local</option>
                        <option value="cloud" className="bg-gray-800 text-white">AI Cloud</option>
                      </select>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* TAB: EPUB TOOLS (VIP) */}
          {activeTab === 'epub' && (
            <div className="max-w-4xl space-y-6">
              
              {/* Check VIP Membership */}
              {settings.membershipType !== 'vip' ? (
                <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-xl border border-yellow-300 p-6 space-y-4 text-center">
                  <span className="material-symbols-outlined text-[48px] text-yellow-600 animate-bounce animate-duration-1000">stars</span>
                  <h3 className="text-base font-extrabold text-gray-800">👑 Hộp công cụ EPUB chỉ dành cho VIP</h3>
                  <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                    Tính năng dịch sách EPUB ngoại tuyến, tự động đóng gói văn bản TXT thành EPUB, tối ưu hóa hiển thị và nhúng từ điển dịch cá nhân hóa yêu cầu tài khoản thành viên VIP.
                  </p>
                  <button 
                    onClick={() => setActiveTab('general')}
                    className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-6 rounded-lg text-xs transition-all shadow-md shadow-yellow-500/20"
                  >
                    Đến trang kích hoạt VIP ngay
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                  {/* Sub Tab Header */}
                  <div className="flex border-b border-gray-200">
                    <button
                      onClick={() => setEpubSubTab('translate')}
                      className={`py-2.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
                        epubSubTab === 'translate'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">g_translate</span>
                      Dịch file EPUB gốc
                    </button>
                    <button
                      onClick={() => setEpubSubTab('convert')}
                      className={`py-2.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
                        epubSubTab === 'convert'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">difference</span>
                      Đóng gói TXT sang EPUB
                    </button>
                    <button
                      onClick={() => setEpubSubTab('optimize')}
                      className={`py-2.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
                        epubSubTab === 'optimize'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">compress</span>
                      Tối ưu hóa EPUB
                    </button>
                  </div>

                  {/* SUBTAB CONTENT 1: TRANSLATE EPUB */}
                  {epubSubTab === 'translate' && (
                    <form onSubmit={handleEpubTranslate} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                      <div className="space-y-2">
                        <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Chọn file EPUB nguồn (Tiếng Trung)</h4>
                        <div className="border-2 border-dashed border-gray-200 hover:border-primary/50 transition-all rounded-lg p-6 flex flex-col items-center justify-center gap-2 bg-gray-50 relative cursor-pointer">
                          <input 
                            type="file" 
                            accept=".epub"
                            onChange={(e) => setEpubFile(e.target.files[0])}
                            className="absolute inset-0 opacity-0 cursor-pointer animate-fade-in"
                          />
                          <span className="material-symbols-outlined text-[32px] text-gray-400">upload_file</span>
                          <span className="text-xs font-semibold text-gray-600">
                            {epubFile ? epubFile.name : "Kéo thả hoặc nhấp để chọn tệp tin .epub"}
                          </span>
                          {epubFile && (
                            <span className="text-[10px] text-gray-400">
                              {(epubFile.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Chế độ dịch thuật</label>
                          <select 
                            value={epubMode}
                            onChange={(e) => setEpubMode(e.target.value)}
                            className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:border-primary"
                          >
                            <option value="fast">Dịch nhanh (Fast Vietphrase)</option>
                            <option value="advanced">Dịch nâng cao (Advanced)</option>
                            <option value="advanced_hanviet">Nâng cao + Hán Việt song song</option>
                            <option value="vietphrase">Vietphrase Gốc (Thô)</option>
                            <option value="hanviet">Hán Việt thuần túy</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Giới hạn số chương dịch thử</label>
                          <input 
                            type="number"
                            value={epubLimit}
                            onChange={(e) => setEpubLimit(parseInt(e.target.value) || -1)}
                            className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg p-2 text-gray-800 focus:outline-none focus:border-primary"
                            placeholder="Nhập -1 để dịch toàn bộ sách"
                          />
                          <span className="text-[10px] text-gray-400">Nên để 5-10 chương đầu để dịch thử xem chất lượng trước khi dịch cả bộ.</span>
                        </div>
                      </div>

                      <div className="space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h5 className="text-[10px] text-gray-500 font-bold uppercase mb-2">Tùy chọn tối ưu hóa Layout & Size</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={epubCleanStyles} 
                              onChange={(e) => setEpubCleanStyles(e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />
                            <div className="text-xs">
                              <div className="font-bold text-gray-700">Dọn dẹp CSS styles</div>
                              <div className="text-[10px] text-gray-400">Xóa style nhúng, lỗi font nền</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={epubStripImages} 
                              onChange={(e) => setEpubStripImages(e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />
                            <div className="text-xs">
                              <div className="font-bold text-gray-700">Loại bỏ ảnh (Strip Images)</div>
                              <div className="text-[10px] text-gray-400">Giảm 90% dung lượng EPUB</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={epubStripFonts} 
                              onChange={(e) => setEpubStripFonts(e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />
                            <div className="text-xs">
                              <div className="font-bold text-gray-700">Loại bỏ Fonts nhúng</div>
                              <div className="text-[10px] text-gray-400">Giúp load sách nhanh trên app mobile</div>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 font-bold uppercase flex justify-between">
                          <span>Từ điển tên riêng cá nhân hóa cho sách (Glossary)</span>
                          <span className="text-[10px] text-gray-400 font-normal normal-case">Mỗi dòng ghi: TừGốcTrung=BảnDịchViệt</span>
                        </label>
                        <textarea 
                          value={epubCustomDict}
                          onChange={(e) => setEpubCustomDict(e.target.value)}
                          className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-2.5 h-24 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder="Ví dụ:&#10;林枫=Lâm Phong&#10;九幽=Cửu U"
                        />
                      </div>

                      {epubStatus && (
                        <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-200 flex items-center gap-2">
                          {epubLoading && <span className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>}
                          <span>{epubStatus}</span>
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={epubLoading}
                        className={`w-full text-xs font-bold text-white py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 ${
                          epubLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark shadow-primary/20'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">play_circle</span>
                        Bắt đầu Dịch & Tải EPUB đã dịch về máy
                      </button>
                    </form>
                  )}

                  {/* SUBTAB CONTENT 2: CONVERT TXT TO EPUB */}
                  {epubSubTab === 'convert' && (
                    <form onSubmit={handleEpubConvertTxt} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Tên sách / Tiêu đề truyện</label>
                          <input 
                            type="text"
                            value={txtTitle}
                            onChange={(e) => setTxtTitle(e.target.value)}
                            className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:border-primary"
                            placeholder="Nhập tên truyện"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Tác giả</label>
                          <input 
                            type="text"
                            value={txtAuthor}
                            onChange={(e) => setTxtAuthor(e.target.value)}
                            className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:border-primary"
                            placeholder="Tên tác giả"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Regex phân tách chương</label>
                          <input 
                            type="text"
                            value={txtRegex}
                            onChange={(e) => setTxtRegex(e.target.value)}
                            className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:border-primary"
                            placeholder="Ví dụ: 第\s*\d+\s*[章|回|节] hoặc Chương\s*\d+"
                          />
                          <span className="text-[10px] text-gray-400">Biểu thức chính quy dùng để xác định tiêu đề chương mới.</span>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-gray-500 font-bold uppercase">Mô tả / Tóm tắt truyện</label>
                          <input 
                            type="text"
                            value={txtDesc}
                            onChange={(e) => setTxtDesc(e.target.value)}
                            className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:border-primary"
                            placeholder="Tóm tắt nội dung ngắn gọn..."
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Dữ liệu nguồn truyện</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-500 font-bold uppercase">Tải lên tệp truyện (.txt)</label>
                            <input 
                              type="file" 
                              accept=".txt"
                              onChange={(e) => setTxtFile(e.target.files[0])}
                              className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:border-primary file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300 cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] text-gray-500 font-bold uppercase">Hoặc dán trực tiếp nội dung truyện</label>
                            <textarea 
                              value={txtPaste}
                              onChange={(e) => setTxtPaste(e.target.value)}
                              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg p-2 h-20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              placeholder="Dán nội dung truyện chữ thô tại đây..."
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={txtTranslate} 
                            onChange={(e) => setTxtTranslate(e.target.checked)}
                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-gray-700">Dịch tự động nội dung sang Tiếng Việt (Vietphrase) khi đóng gói</div>
                            <div className="text-[10px] text-gray-400">Nếu văn bản gốc là Tiếng Trung thô, hệ thống sẽ gọi dịch tự động trước khi đóng gói thành EPUB</div>
                          </div>
                        </label>

                        {txtTranslate && (
                          <div className="pl-6.5 space-y-1.5 animate-fade-in">
                            <label className="text-[10px] text-gray-500 font-bold uppercase">Lựa chọn chế độ dịch</label>
                            <select 
                              value={epubMode}
                              onChange={(e) => setEpubMode(e.target.value)}
                              className="text-xs font-semibold bg-white border border-gray-200 rounded-lg p-2 text-gray-800 focus:outline-none focus:border-primary"
                            >
                              <option value="fast">Dịch nhanh (Fast Vietphrase)</option>
                              <option value="advanced">Dịch nâng cao (Advanced)</option>
                              <option value="vietphrase">Vietphrase Gốc (Thô)</option>
                              <option value="hanviet">Hán Việt thuần túy</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {epubStatus && (
                        <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-200 flex items-center gap-2">
                          {epubLoading && <span className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>}
                          <span>{epubStatus}</span>
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={epubLoading}
                        className={`w-full text-xs font-bold text-white py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 ${
                          epubLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark shadow-primary/20'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">build</span>
                        Tạo sách EPUB & Tải về máy
                      </button>
                    </form>
                  )}

                  {/* SUBTAB CONTENT 3: OPTIMIZE EPUB */}
                  {epubSubTab === 'optimize' && (
                    <form onSubmit={handleEpubOptimize} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                      <div className="space-y-2">
                        <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Chọn file EPUB cần tối ưu hóa bố cục</h4>
                        <div className="border-2 border-dashed border-gray-200 hover:border-primary/50 transition-all rounded-lg p-6 flex flex-col items-center justify-center gap-2 bg-gray-50 relative cursor-pointer">
                          <input 
                            type="file" 
                            accept=".epub"
                            onChange={(e) => setEpubFile(e.target.files[0])}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          <span className="material-symbols-outlined text-[32px] text-gray-400">restart_alt</span>
                          <span className="text-xs font-semibold text-gray-600">
                            {epubFile ? epubFile.name : "Kéo thả hoặc nhấp để chọn tệp tin .epub"}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                          Công cụ này sẽ loại bỏ hoàn toàn các thẻ layout lỗi, file css nhúng gây tràn màn hình, nén ảnh bìa và tối giản định dạng để sách tương thích 100% với các ứng dụng đọc trên điện thoại (như Moon+, Lithium, Apple Books, v.v.).
                        </p>
                      </div>

                      <div className="space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h5 className="text-[10px] text-gray-500 font-bold uppercase mb-2">Tùy chọn dọn dẹp</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={epubStripImages} 
                              onChange={(e) => setEpubStripImages(e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />
                            <div className="text-xs">
                              <div className="font-bold text-gray-700">Loại bỏ toàn bộ hình ảnh minh họa bên trong</div>
                              <div className="text-[10px] text-gray-400">Chỉ giữ lại chữ để sách nhẹ và tải siêu nhanh</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={epubStripFonts} 
                              onChange={(e) => setEpubStripFonts(e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />
                            <div className="text-xs">
                              <div className="font-bold text-gray-700">Loại bỏ custom fonts nhúng</div>
                              <div className="text-[10px] text-gray-400">Sử dụng font hệ thống mượt mà trên mobile</div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {epubStatus && (
                        <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-200 flex items-center gap-2">
                          {epubLoading && <span className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>}
                          <span>{epubStatus}</span>
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={epubLoading}
                        className={`w-full text-xs font-bold text-white py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 ${
                          epubLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark shadow-primary/20'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">compress</span>
                        Bắt đầu Tối ưu & Tải sách về máy
                      </button>
                    </form>
                  )}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: AI ASSISTANT SETTINGS */}
          {activeTab === 'ai' && (
            <div className="max-w-3xl space-y-6">
              
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">key</span>
                  Khóa API AI (API Key)
                </h3>
                <p className="text-xs text-gray-500">
                  Điền API Key của Gemini hoặc OpenAI để sử dụng tính năng giải nghĩa từ, tóm tắt chương truyện hoặc dịch bằng AI.
                </p>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Lựa chọn Mô hình AI</label>
                    <select
                      value={settings.aiModel}
                      onChange={(e) => updateSetting('aiModel', e.target.value)}
                      className="w-full h-9 px-3 border border-gray-300 rounded-lg text-xs outline-none focus:border-yellow-500"
                    >
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Nhanh & Tiết kiệm)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Thông minh nhất)</option>
                      <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
                      <option value="gpt-4o">GPT-4o (OpenAI Premium)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">API Key</label>
                    <input
                      type="password"
                      value={settings.aiKey}
                      onChange={(e) => updateSetting('aiKey', e.target.value)}
                      placeholder="Nhập khóa API (ví dụ: AIzaSy... hoặc sk-...)"
                      className="w-full h-9 px-3 border border-gray-300 rounded-lg text-xs outline-none focus:border-yellow-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">edit_note</span>
                  System Prompt Dịch Thuật
                </h3>
                <p className="text-xs text-gray-500">
                  Điều chỉnh ngữ cảnh hoặc yêu cầu dịch của bạn để Trợ lý AI thực hiện dịch sát nghĩa nhất.
                </p>
                <textarea
                  value={settings.aiPrompt}
                  onChange={(e) => updateSetting('aiPrompt', e.target.value)}
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg text-xs outline-none focus:border-yellow-500"
                />
              </div>

            </div>
          )}

          {/* TAB 3: FULL SCREEN NOVEL SEARCH */}
          {activeTab === 'search' && (
            <div className="w-full h-[calc(100vh-170px)] bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden p-2">
                {/* Re-use the optimized DBSearch inside full-screen layout */}
                <DBSearch />
              </div>
            </div>
          )}

          {/* TAB 4: TTS AUDIO SETTINGS */}
          {activeTab === 'tts' && (
            <div className="max-w-3xl space-y-6">
              
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">speech_to_text</span>
                  Cài đặt Giọng Đọc (TTS)
                </h3>

                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Lựa chọn Giọng đọc mặc định</label>
                    <select
                      value={settings.ttsVoice}
                      onChange={(e) => updateSetting('ttsVoice', e.target.value)}
                      className="w-full h-9 px-3 border border-gray-300 rounded-lg text-xs outline-none focus:border-yellow-500"
                    >
                      <option value="vi-VN-Standard-A">Tiếng Việt - Giọng Nữ Bắc (Standard A)</option>
                      <option value="vi-VN-Standard-B">Tiếng Việt - Giọng Nam Bắc (Standard B)</option>
                      <option value="vi-VN-Standard-C">Tiếng Việt - Giọng Nữ Nam (Standard C)</option>
                      <option value="vi-VN-Standard-D">Tiếng Việt - Giọng Nam Nam (Standard D)</option>
                    </select>
                  </div>

                  {/* Range sliders */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col">
                      <div className="flex justify-between text-xs font-bold text-gray-800">
                        <span>Tốc độ đọc (Speed)</span>
                        <span className="text-primary">{settings.ttsSpeed}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={settings.ttsSpeed}
                        onChange={(e) => updateSetting('ttsSpeed', parseFloat(e.target.value))}
                        className="w-full accent-yellow-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="flex justify-between text-xs font-bold text-gray-800">
                        <span>Cao độ giọng (Pitch)</span>
                        <span className="text-primary">{settings.ttsPitch}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.1"
                        value={settings.ttsPitch}
                        onChange={(e) => updateSetting('ttsPitch', parseFloat(e.target.value))}
                        className="w-full accent-yellow-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
                      />
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-800">Tự động chuyển chương khi đọc xong</span>
                      <span className="text-[11px] text-gray-500">Tự động phát audio chương tiếp theo sau khi chương cũ kết thúc.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.autoPlayNext}
                        onChange={(e) => updateSetting('autoPlayNext', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
                    </label>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 5: HISTORY & STATS */}
          {activeTab === 'history' && (
            <div className="max-w-4xl space-y-6">
              
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">history</span>
                    Lịch sử dịch trang gần đây
                  </h3>
                  {history.length > 0 && (
                    <button
                      onClick={clearHistory}
                      className="text-xs text-red-500 hover:text-red-600 font-bold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Xóa tất cả
                    </button>
                  )}
                </div>
                
                {history.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">Chưa có lịch sử dịch web nào.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {history.map((item, idx) => (
                      <div key={idx} className="py-3 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.favIconUrl ? (
                            <img src={item.favIconUrl} alt="" className="w-4 h-4 rounded shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <span className="material-symbols-outlined text-gray-400 text-[16px] shrink-0">public</span>
                          )}
                          <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium truncate">
                            {item.title || item.url}
                          </a>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0 ml-4">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
