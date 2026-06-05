import React, { useState, useEffect } from 'react';

export default function DetectCurrentPage({ onAnalyze, onListenTTS }) {
  const [tabInfo, setTabInfo] = useState({
    title: 'Đang tải...',
    url: '...',
    favIconUrl: '',
    fullUrl: ''
  });
  const [isAuto, setIsAuto] = useState(false);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          const tab = tabs[0];
          let displayUrl = tab.url;
          try {
            const urlObj = new URL(tab.url);
            displayUrl = urlObj.hostname + urlObj.pathname;
            if (displayUrl.length > 30) displayUrl = displayUrl.substring(0, 30) + '...';
          } catch(e) {}
          
          setTabInfo({
            title: tab.title || 'Trang web không tên',
            url: displayUrl,
            favIconUrl: tab.favIconUrl || '',
            fullUrl: tab.url
          });
        }
      });

      chrome.storage.local.get(['autoTranslate'], (res) => {
        setIsAuto(!!res.autoTranslate);
      });

      const listener = (changes, namespace) => {
        if (namespace === 'local' && changes.autoTranslate) {
          setIsAuto(changes.autoTranslate.newValue);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    } else {
      setTabInfo({
        title: 'Trang web giả lập (Dev)',
        url: 'localhost:5173/dev...',
        favIconUrl: '',
        fullUrl: 'http://localhost:5173'
      });
    }
  }, []);

  const handleToggle = () => {
    const newState = !isAuto;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ autoTranslate: newState });
    }
    setIsAuto(newState);
    
    if (newState && onAnalyze) {
      onAnalyze(tabInfo, true);
    }
  };

  const handleListenTTS = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: "GET_CLEAN_TEXT" }, function(response) {
          if (response && response.success && response.data) {
            onListenTTS(response.data);
          } else {
            alert("Không thể trích xuất nội dung chương truyện ở trang web này!");
          }
        });
      } catch (error) {
        console.error("Lỗi khi kết nối content script:", error);
      }
    } else {
      onListenTTS({
        novelTitle: "Vạn Đạo Kiếm Tôn (Dev)",
        chapterTitle: "Chương 1: Thụ Kiếm",
        author: "Mạc Mặc",
        cover: "",
        text: "Trời nhá nhem tối, mây đen vần vũ che kín bầu trời, những hạt mưa lất phất bắt đầu rơi xuống những mái nhà ngói đỏ của Kiếm Tông. Tiếng mưa rơi rả rích như một bản nhạc buồn bã, vang vọng khắp sơn môn tĩnh lặng.\n\nTrong một căn phòng nhỏ xập xệ nằm ở góc hẻo lánh nhất của ngoại môn, Lâm Dật đang ngồi bó gối trên chiếc giường tre ọp ẹp...",
        paragraphs: [
          "Trời nhá nhem tối, mây đen vần vũ che kín bầu trời, những hạt mưa lất phất bắt đầu rơi xuống những mái nhà ngói đỏ của Kiếm Tông. Tiếng mưa rơi rả rích như một bản nhạc buồn bã, vang vọng khắp sơn môn tĩnh lặng.",
          "Trong một căn phòng nhỏ xập xệ nằm ở góc hẻo lánh nhất của ngoại môn, Lâm Dật đang ngồi bó gối trên chiếc giường tre ọp ẹp..."
        ]
      });
    }
  };

  return (
    <section className="bg-secondary-fixed text-on-secondary-fixed p-4 rounded-xl border border-outline-variant shadow-sm space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
          {tabInfo.favIconUrl ? (
            <img 
              alt="Website Favicon" 
              className="w-6 h-6 object-contain" 
              src={tabInfo.favIconUrl}
            />
          ) : (
            <span className="material-symbols-outlined text-outline">language</span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="font-label-sm text-label-sm text-on-secondary-fixed-variant uppercase">Trang hiện tại</p>
          <h3 className="font-headline-xs text-headline-xs truncate" title={tabInfo.title}>{tabInfo.title}</h3>
          <p className="font-body-sm text-body-sm opacity-80 truncate" title={tabInfo.fullUrl}>{tabInfo.url}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={handleToggle}
          className={`flex-1 h-9 rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all ${isAuto ? 'bg-error text-white' : 'bg-on-secondary-fixed text-white'}`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isAuto ? 'stop_circle' : 'auto_fix_high'}
          </span>
          {isAuto ? 'Dừng Dịch' : 'Bắt đầu Dịch'}
        </button>
        <button 
          onClick={handleListenTTS}
          className="flex-1 h-9 bg-primary text-on-primary rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">play_circle</span>
          Nghe đọc AI (TTS)
        </button>
      </div>
    </section>
  );
}
