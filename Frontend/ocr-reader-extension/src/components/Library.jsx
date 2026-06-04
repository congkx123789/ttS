import React, { useState, useEffect } from 'react';
import DataSync from './DataSync';

export default function Library() {
  const [activeView, setActiveView] = useState('library'); // 'library', 'history', or 'sync'
  const [serverUrl, setServerUrl] = useState('http://localhost:5051');
  const [novels, setNovels] = useState([]);
  const [historyGroups, setHistoryGroups] = useState([]);
  const [localHistory, setLocalHistory] = useState([]); // local history stored in chrome extension
  const [loading, setLoading] = useState(false);
  const [syncingLocal, setSyncingLocal] = useState(false);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Initial load and storage listeners for dynamic sync
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['serverUrl', 'serverUser', 'offlineTranslationHistory'], (result) => {
        if (result.serverUrl) setServerUrl(result.serverUrl);
        if (result.serverUser) setUser(result.serverUser);
        if (result.offlineTranslationHistory) setLocalHistory(result.offlineTranslationHistory);
      });

      const listener = (changes, areaName) => {
        if (areaName === 'local') {
          if (changes.serverUrl) {
            setServerUrl(changes.serverUrl.newValue || 'http://localhost:5051');
          }
          if (changes.serverUser) {
            setUser(changes.serverUser.newValue || null);
          }
          if (changes.offlineTranslationHistory) {
            setLocalHistory(changes.offlineTranslationHistory.newValue || []);
          }
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  // Fetch whenever active view changes
  useEffect(() => {
    if (activeView === 'library') {
      fetchBookshelf();
    } else if (activeView === 'history') {
      fetchHistory();
    }
  }, [activeView, serverUrl, searchQuery]);

  const loadLocalHistoryData = () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['offlineTranslationHistory'], (result) => {
        if (result.offlineTranslationHistory) {
          setLocalHistory(result.offlineTranslationHistory);
        }
      });
    }
  };

  const syncStorageUser = (userData) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ serverUser: userData });
      chrome.storage.local.get(['settings'], (storageRes) => {
        const settings = storageRes.settings || {};
        let changed = false;
        if (userData.vip_status === 1) {
          if (settings.membershipType !== 'vip') {
            settings.membershipType = 'vip';
            settings.vipKey = settings.vipKey || 'VIP_SERVER';
            changed = true;
          }
        } else {
          if (settings.membershipType === 'vip' && settings.vipKey === 'VIP_SERVER') {
            settings.membershipType = 'standard';
            settings.vipKey = '';
            changed = true;
          }
        }
        if (changed) {
          chrome.storage.local.set({ settings });
        }
      });
    }
  };

  const handleLoggedOutCleanup = () => {
    setUser(null);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['serverUser']);
      chrome.storage.local.get(['settings'], (storageRes) => {
        const settings = storageRes.settings || {};
        if (settings.vipKey === 'VIP_SERVER') {
          settings.membershipType = 'standard';
          settings.vipKey = '';
          chrome.storage.local.set({ settings });
        }
      });
    }
  };

  const fetchBookshelf = async () => {
    setLoading(true);
    try {
      const authRes = await fetch(`${serverUrl}/api/auth/me`, { credentials: 'include' });
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.logged_in) {
          setUser(authData.user);
          syncStorageUser(authData.user);
          const res = await fetch(`${serverUrl}/api/bookshelf?q=${encodeURIComponent(searchQuery)}`, {
            method: 'GET',
            credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            setNovels(data);
          }
        } else {
          handleLoggedOutCleanup();
          setNovels([]);
        }
      }
    } catch (e) {
      console.warn("Lỗi khi tải tủ sách từ Server:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    loadLocalHistoryData(); // always reload local history to keep states synchronized
    if (!user) {
      // If offline/not logged in, we only use local history
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const authRes = await fetch(`${serverUrl}/api/auth/me`, { credentials: 'include' });
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.logged_in) {
          setUser(authData.user);
          syncStorageUser(authData.user);
          const res = await fetch(`${serverUrl}/api/history?q=${encodeURIComponent(searchQuery)}`, {
            method: 'GET',
            credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            setHistoryGroups(data);
          }
        } else {
          handleLoggedOutCleanup();
          setHistoryGroups([]);
        }
      }
    } catch (e) {
      console.warn("Lỗi khi tải lịch sử từ Server:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBook = async (e, book) => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc muốn xóa "${book.title}" khỏi tủ sách?`)) {
      return;
    }

    try {
      const payload = book.book_id ? { book_id: book.book_id } : { url: book.url };
      const res = await fetch(`${serverUrl}/api/bookshelf/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (res.ok) {
        alert("Đã xóa truyện khỏi tủ sách thành công!");
        fetchBookshelf();
      } else {
        alert("Có lỗi xảy ra khi xóa.");
      }
    } catch (err) {
      alert("Lỗi kết nối.");
    }
  };

  const handleClearHistory = async () => {
    if (user) {
      if (!window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử đọc online trên máy chủ?")) {
        return;
      }
      try {
        const res = await fetch(`${serverUrl}/api/history/clear`, {
          method: 'POST',
          credentials: 'include'
        });
        if (res.ok) {
          alert("Đã dọn sạch lịch sử đọc trực tuyến!");
          fetchHistory();
        } else {
          alert("Có lỗi xảy ra khi dọn lịch sử.");
        }
      } catch (err) {
        alert("Lỗi kết nối.");
      }
    } else {
      if (!window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử offline lưu trên máy này?")) {
        return;
      }
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.remove(['offlineTranslationHistory'], () => {
          setLocalHistory([]);
          alert("Đã dọn sạch lịch sử offline thành công!");
        });
      }
    }
  };

  // Sync all local offline history to the online database server
  const handleSyncLocalHistoryToServer = async () => {
    if (!user) {
      alert("Vui lòng đăng nhập trước khi thực hiện đồng bộ!");
      return;
    }
    if (localHistory.length === 0) {
      alert("Không có lịch sử offline nào để đồng bộ.");
      return;
    }

    setSyncingLocal(true);
    let successCount = 0;
    try {
      for (const item of localHistory) {
        // Sync item using backend sync endpoint
        const res = await fetch(`${serverUrl}/api/extension/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: item.url,
            title: item.title,
            author: item.author || "Không rõ",
            last_chapter: item.last_chapter || "Chương đọc",
            cover: item.favIconUrl || "",
            action: "history"
          }),
          credentials: 'include'
        });
        if (res.ok) successCount++;
      }

      alert(`Đồng bộ thành công ${successCount}/${localHistory.length} mục lịch sử lên Máy chủ!`);
      
      // Clear offline history after successful synchronization to prevent duplicates
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.remove(['offlineTranslationHistory'], () => {
          setLocalHistory([]);
          fetchHistory();
        });
      }
    } catch (err) {
      console.error(err);
      alert("Quá trình đồng bộ bị gián đoạn do lỗi kết nối.");
    } finally {
      setSyncingLocal(false);
    }
  };

  const handleNovelClick = (novel) => {
    if (novel.book_id) {
      const readUrl = `${serverUrl}/?book_id=${novel.book_id}`;
      window.open(readUrl, '_blank');
    } else if (novel.url) {
      window.open(novel.url, '_blank');
    }
  };

  // Filtered local history based on search query
  const filteredLocalHistory = localHistory.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (item.title || '').toLowerCase().includes(q) || (item.url || '').toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full bg-background space-y-4 overflow-hidden">
      
      {/* 3-View Switcher Tab Bar */}
      <div className="flex bg-surface-container p-1 rounded-lg border border-outline-variant shrink-0 mx-4 mt-4 select-none">
        <button 
          className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-all flex justify-center items-center gap-1 ${activeView === 'library' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          onClick={() => setActiveView('library')}
        >
          <span className="material-symbols-outlined text-[15px]">library_books</span>
          Tủ sách
        </button>
        <button 
          className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-all flex justify-center items-center gap-1 ${activeView === 'history' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          onClick={() => setActiveView('history')}
        >
          <span className="material-symbols-outlined text-[15px]">history</span>
          Lịch sử
        </button>
        <button 
          className={`flex-1 py-1.5 text-[11px] font-bold rounded transition-all flex justify-center items-center gap-1 ${activeView === 'sync' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          onClick={() => setActiveView('sync')}
        >
          <span className="material-symbols-outlined text-[15px]">sync</span>
          Đồng bộ
        </button>
      </div>

      {activeView !== 'sync' && (
        /* Search and Filters Area */
        <div className="flex gap-2 items-center px-4 shrink-0">
          <form 
            onSubmit={(e) => { e.preventDefault(); activeView === 'library' ? fetchBookshelf() : fetchHistory(); }}
            className="relative flex-1"
          >
            <span className="absolute left-3 top-2.5 text-outline material-symbols-outlined text-[18px]">search</span>
            <input 
              type="text" 
              placeholder={activeView === 'library' ? "Tìm kiếm truyện..." : "Tìm lịch sử..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] bg-surface-container-low text-xs text-on-surface rounded-lg pl-8 pr-3 border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline outline-none transition-all"
            />
          </form>
          
          {activeView === 'history' && (user ? historyGroups.length > 0 : filteredLocalHistory.length > 0) && (
            <button 
              onClick={handleClearHistory}
              className="px-2.5 h-[34px] bg-error-container hover:bg-error/10 text-error rounded-lg flex items-center justify-center gap-1 text-[11px] font-bold border border-error/20 transition-all active:scale-95 shrink-0"
              title="Xóa tất cả lịch sử"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              Xóa sạch
            </button>
          )}

          {activeView === 'history' && user && localHistory.length > 0 && (
            <button 
              onClick={handleSyncLocalHistoryToServer}
              disabled={syncingLocal}
              className="px-2.5 h-[34px] bg-primary-container text-on-primary-fixed hover:bg-primary-container/80 rounded-lg flex items-center justify-center gap-1 text-[11px] font-bold border border-primary/20 transition-all active:scale-95 shrink-0 disabled:opacity-50"
              title="Đồng bộ lịch sử offline lên Máy chủ"
            >
              <span className="material-symbols-outlined text-[16px]">{syncingLocal ? 'sync' : 'cloud_upload'}</span>
              {syncingLocal ? 'Đang đồng bộ...' : 'Đẩy lên m.chủ'}
            </button>
          )}

          <button 
            onClick={activeView === 'library' ? fetchBookshelf : fetchHistory}
            className="w-[34px] h-[34px] bg-surface-container-low border border-outline-variant rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-2">
            <span className="material-symbols-outlined animate-spin text-primary text-[28px]">sync</span>
            <p className="text-[11px] text-on-surface-variant">Đang tải danh sách...</p>
          </div>
        ) : !user && activeView === 'library' ? (
          /* User not logged in message (Bookshelf requires online server) */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <span className="material-symbols-outlined text-[44px] text-on-surface-variant">lock</span>
            <h3 className="text-xs font-bold text-on-surface">Yêu cầu Đăng nhập</h3>
            <p className="text-[11px] text-on-surface-variant max-w-[260px] leading-relaxed">
              Vui lòng kết nối và đăng nhập tài khoản hệ thống của bạn ở tab <strong>Đồng bộ</strong> để xem tủ sách trực tuyến.
            </p>
            <button 
              onClick={() => setActiveView('sync')}
              className="px-4 py-2 bg-primary text-white text-[11px] font-bold rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              Đi tới Đăng nhập
            </button>
          </div>
        ) : activeView === 'library' ? (
          /* Bookshelf Grid View */
          novels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <span className="material-symbols-outlined text-[44px] text-on-surface-variant">import_contacts</span>
              <h3 className="text-xs font-bold text-on-surface">Tủ sách trống</h3>
              <p className="text-[11px] text-on-surface-variant max-w-[240px]">
                Bạn chưa lưu truyện nào. Hãy sử dụng extension dịch để lưu sách vào tủ!
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                {novels.map((novel, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleNovelClick(novel)}
                    className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden p-2 gap-1.5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group relative"
                  >
                    {/* Cover Image */}
                    <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-surface-container">
                      {novel.cover ? (
                        <img 
                          src={novel.cover} 
                          alt={novel.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-surface-container-high text-on-surface-variant p-2 text-center">
                          <span className="material-symbols-outlined text-[28px] text-outline">book</span>
                          <span className="text-[9px] mt-1 font-semibold line-clamp-2">{novel.title}</span>
                        </div>
                      )}
                      
                      <div className="absolute top-1 left-1">
                        <span className="text-[8px] px-1.5 py-0.5 bg-surface-container-highest/90 text-primary rounded font-bold backdrop-blur-sm border border-outline-variant shadow-sm uppercase">
                          {novel.book_id ? "DỊCH CHUẨN" : "NGOÀI"}
                        </span>
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="flex flex-col flex-1">
                      <h3 className="text-[11px] font-bold text-on-surface line-clamp-1 leading-tight mb-1">{novel.title}</h3>
                      <p className="text-[10px] text-on-surface-variant line-clamp-1">✍ {novel.author || 'Ẩn danh'}</p>
                      
                      <div className="mt-auto pt-2 flex gap-1">
                        <button 
                          className="flex-1 h-7 bg-primary hover:bg-primary/95 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95"
                          onClick={(e) => { e.stopPropagation(); handleNovelClick(novel); }}
                        >
                          Đọc tiếp
                        </button>
                        <button 
                          onClick={(e) => handleRemoveBook(e, novel)}
                          className="w-7 h-7 bg-surface-container-high hover:bg-error/10 text-on-surface-variant hover:text-error rounded-lg flex items-center justify-center border border-outline-variant transition-colors"
                          title="Xóa khỏi tủ"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : activeView === 'history' ? (
          /* History View: check if remote or local */
          user ? (
            /* Online Grouped History */
            historyGroups.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <span className="material-symbols-outlined text-[44px] text-on-surface-variant">history</span>
                <h3 className="text-xs font-bold text-on-surface">Không có lịch sử online</h3>
                <p className="text-[11px] text-on-surface-variant max-w-[240px]">
                  Hãy mở đọc truyện để bắt đầu ghi lại lịch sử đọc trực tuyến của bạn.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar space-y-4">
                {historyGroups.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-1.5">
                    <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider px-1">
                      🗓️ {group.group_name}
                    </h4>
                    <div className="space-y-2">
                      {group.books.map((book, bIdx) => (
                        <div 
                          key={bIdx}
                          onClick={() => handleNovelClick(book)}
                          className="flex bg-surface-container-lowest border border-outline-variant rounded-xl p-2 gap-3 hover:border-primary/50 transition-all cursor-pointer items-center group"
                        >
                          <div className="w-10 h-14 bg-surface-container rounded-lg overflow-hidden shrink-0">
                            {book.cover ? (
                              <img src={book.cover} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-surface-container-high text-outline">
                                <span className="material-symbols-outlined text-[18px]">book</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-[11px] font-bold text-on-surface truncate leading-tight group-hover:text-primary transition-colors">
                              {book.title}
                            </h5>
                            <p className="text-[9px] text-on-surface-variant truncate mt-0.5">
                              ✍ {book.author || 'Ẩn danh'}
                            </p>
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-[9px] px-1 py-0.2 bg-secondary-container/60 text-secondary rounded font-medium">
                                Chương cuối:
                              </span>
                              <span className="text-[9px] text-on-surface font-semibold truncate max-w-[120px]" title={book.last_chapter}>
                                {book.last_chapter || 'Chưa rõ'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[8px] px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant rounded border border-outline-variant font-bold shrink-0 self-start">
                            {book.book_id ? "DỊCH CHUẨN" : "NGOÀI"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Local Offline History (No login required) */
            filteredLocalHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <span className="material-symbols-outlined text-[44px] text-on-surface-variant">devices</span>
                <h3 className="text-xs font-bold text-on-surface">Lịch sử offline trống</h3>
                <p className="text-[11px] text-on-surface-variant max-w-[240px]">
                  Chưa ghi nhận chương truyện nào đã dịch trên máy này. Hãy mở một trang truyện để hệ thống tự ghi nhận lịch sử cục bộ!
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar space-y-3">
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded-xl text-center mb-1">
                  <p className="text-[10px] text-yellow-800 font-semibold leading-relaxed">
                    💡 Đang hiển thị lịch sử offline lưu trên máy này. Đăng nhập ở tab <strong>Đồng bộ</strong> để đồng bộ và lưu trữ trực tuyến vĩnh viễn.
                  </p>
                </div>
                
                <h4 className="text-[10px] font-bold text-secondary uppercase tracking-wider px-1">
                  💻 ĐÃ DỊCH GẦN ĐÂY TRÊN THIẾT BỊ NÀY
                </h4>
                <div className="space-y-2">
                  {filteredLocalHistory.map((item, bIdx) => (
                    <div 
                      key={bIdx}
                      onClick={() => handleNovelClick(item)}
                      className="flex bg-surface-container-lowest border border-outline-variant rounded-xl p-2 gap-3 hover:border-primary/50 transition-all cursor-pointer items-center group"
                    >
                      <div className="w-10 h-10 bg-surface-container rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-outline">
                        {item.favIconUrl ? (
                          <img src={item.favIconUrl} alt="" className="w-6 h-6 object-contain" onError={(e) => e.target.style.display = 'none'} />
                        ) : (
                          <span className="material-symbols-outlined text-[18px]">public</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-[11px] font-bold text-on-surface truncate leading-tight group-hover:text-primary transition-colors">
                          {item.title || "Truyện không tên"}
                        </h5>
                        <p className="text-[9px] text-on-surface-variant truncate mt-0.5">
                          🔗 {item.url}
                        </p>
                      </div>
                      <span className="text-[8px] px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant rounded border border-outline-variant font-bold shrink-0 self-center">
                        OFFLINE
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )
        ) : (
          /* DataSync settings tab */
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
            <DataSync onSyncFinished={() => { setActiveView('library'); fetchBookshelf(); }} />
          </div>
        )}
      </div>

      {/* Sync Status Footer bar */}
      {user && activeView !== 'sync' && (
        <div className="px-4 py-2 bg-surface-container-low border-t border-outline-variant flex justify-between items-center shrink-0 pb-[76px] text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-on-surface-variant">Tài khoản: <strong>{user.username}</strong></span>
          </div>
          <button 
            onClick={activeView === 'library' ? fetchBookshelf : fetchHistory}
            className="text-primary font-bold hover:underline"
          >
            Đồng bộ lại
          </button>
        </div>
      )}

    </div>
  );
}
