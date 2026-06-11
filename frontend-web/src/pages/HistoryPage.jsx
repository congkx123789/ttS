import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { History, Trash2, Loader, BookOpen, ExternalLink, Clock, X, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HistoryPage() {
  const { t, lang } = useLang();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [historyGroups, setHistoryGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      setLoading(false);
      return;
    }
    fetchHistory();
  }, [user, authLoading]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/history', { params: searchQ ? { q: searchQ } : {} });
      setHistoryGroups(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    const confirmMsg = lang === 'vi'
      ? "Bạn có chắc muốn xóa tất cả lịch sử đọc?"
      : lang === 'en' ? "Are you sure you want to clear all reading history?"
      : "您确定要清空所有阅读历史记录吗？";
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.post('/api/history/clear');
      setHistoryGroups([]);
    } catch (e) {
      alert(lang === 'vi' ? 'Không xóa được lịch sử.' : lang === 'en' ? 'Failed to clear history.' : '无法清空历史记录。');
    }
  };

  const handleDeleteItem = async (bookId, url, e) => {
    if (e) e.stopPropagation();
    const ident = bookId || url;
    if (!ident) return;
    setDeletingId(ident);
    try {
      await api.post('/api/history/remove', bookId ? { book_id: bookId } : { url: url });
      setHistoryGroups(prev =>
        prev
          .map(g => ({
            ...g,
            books: g.books.filter(b => (b.book_id !== bookId && b.url !== url) && (b.book_id || b.url) !== ident)
          }))
          .filter(g => g.books.length > 0)
      );
    } catch (e) {
      setHistoryGroups(prev =>
        prev
          .map(g => ({
            ...g,
            books: g.books.filter(b => (b.book_id !== bookId && b.url !== url) && (b.book_id || b.url) !== ident)
          }))
          .filter(g => g.books.length > 0)
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectItem = (b) => {
    const ident = b.book_id || b.url;
    if (!ident) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(ident)) {
        next.delete(ident);
      } else {
        next.add(ident);
      }
      return next;
    });
  };

  const getAllItemIds = () => {
    const ids = [];
    historyGroups.forEach(g => {
      g.books.forEach(b => {
        const ident = b.book_id || b.url;
        if (ident) ids.push(ident);
      });
    });
    return ids;
  };

  const handleSelectAll = () => {
    const allIds = getAllItemIds();
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = window.confirm(
      lang === 'vi' 
        ? `Bạn có chắc chắn muốn xóa ${selectedIds.size} truyện khỏi lịch sử không?`
        : `Are you sure you want to clear ${selectedIds.size} selected books from history?`
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      const booksToDel = [];
      historyGroups.forEach(g => {
        g.books.forEach(b => {
          const ident = b.book_id || b.url;
          if (selectedIds.has(ident)) {
            booksToDel.push(b);
          }
        });
      });
      await Promise.all(
        booksToDel.map(b => 
          api.post('/api/history/remove', b.book_id ? { book_id: b.book_id } : { url: b.url })
        )
      );
      setSelectedIds(new Set());
      setIsEditMode(false);
      await fetchHistory();
    } catch (e) {
      alert("Không thể xóa hàng loạt lịch sử.");
    } finally {
      setLoading(false);
    }
  };

  const totalBooks = historyGroups.reduce((sum, g) => sum + g.books.length, 0);

  if (authLoading) {
    return (
      <MainLayout>
        <div className="py-20 text-center text-slate-500">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-500" />
          <span>{lang === 'vi' ? 'Đang tải thông tin...' : lang === 'en' ? 'Loading info...' : '正在加载信息...'}</span>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="py-20 text-center text-slate-500">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mx-auto mb-4">
            🔒
          </div>
          <p className="text-sm">{t.loginToViewHistory}</p>
        </div>
      </MainLayout>
    );
  }

  const allItemIds = getAllItemIds();
  const isAllSelected = selectedIds.size === allItemIds.length && allItemIds.length > 0;

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <History className="w-6 h-6 text-brand-400" />
            {lang === 'vi' ? 'Lịch Sử Đọc Truyện' : lang === 'en' ? 'Reading History' : '阅读历史'}
          </h2>
          
          {totalBooks > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  setSelectedIds(new Set());
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  isEditMode
                    ? 'bg-purple-600/25 border-purple-500/50 text-purple-300 hover:bg-purple-600/35'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {isEditMode 
                  ? (lang === 'vi' ? 'Thoát quản lý' : 'Exit management') 
                  : (lang === 'vi' ? 'Quản lý lịch sử' : 'Manage history')}
              </button>

              {isEditMode && (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 bg-[#121225] border border-[#1f1f3a] rounded-lg text-xs font-bold text-slate-300 hover:bg-[#1a1a35] transition-all"
                  >
                    {isAllSelected 
                      ? (lang === 'vi' ? 'Hủy chọn tất cả' : 'Deselect all') 
                      : (lang === 'vi' ? 'Chọn tất cả' : 'Select all')}
                  </button>

                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-rose-950/20 transition-all active:scale-95 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {lang === 'vi' ? `Xóa hàng loạt (${selectedIds.size})` : `Bulk Delete (${selectedIds.size})`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {totalBooks > 0 && (
            <p className="text-xs text-slate-500">
              {lang === 'vi' ? `${totalBooks} truyện` : `${totalBooks} books`}
            </p>
          )}

          <div className="flex items-center gap-2">
            {/* Search box */}
            <div className="relative">
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchHistory()}
                placeholder={lang === 'vi' ? 'Tìm lịch sử...' : 'Search history...'}
                className="bg-[#12122b]/80 border border-[#232342] rounded-xl px-3 py-2 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors w-36 sm:w-44"
              />
              {searchQ && (
                <button onClick={() => { setSearchQ(''); fetchHistory(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {totalBooks > 0 && !isEditMode && (
              <button
                onClick={handleClearHistory}
                className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {lang === 'vi' ? 'Xóa tất cả' : 'Clear All'}
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500">
          <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
          <span>{t.loading}</span>
        </div>
      ) : historyGroups.length === 0 ? (
        <div className="py-20 text-center text-slate-500 bg-[#121225]/40 border border-dashed border-[#1f1f3a] rounded-2xl">
          <History className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm font-semibold">
            {lang === 'vi' ? 'Chưa có lịch sử đọc truyện.' : lang === 'en' ? 'No reading history yet.' : '暂无阅读历史记录。'}
          </p>
          <p className="text-xs mt-1 text-slate-600">
            {lang === 'vi' ? 'Click vào bất kỳ truyện nào để bắt đầu theo dõi.' : lang === 'en' ? 'Click any book to start tracking.' : '点击任意小说开始跟踪。'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {historyGroups.map(group => (
            <div key={group.group_name} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-brand-400" />
                <h3 className="text-xs font-extrabold text-brand-400 uppercase tracking-wider">
                  {lang === 'en'
                    ? group.group_name === 'Hôm nay' ? 'Today'
                      : group.group_name === 'Hôm qua' ? 'Yesterday'
                      : group.group_name === 'Tháng này' ? 'This Month'
                      : 'Earlier'
                    : lang === 'zh'
                    ? group.group_name === 'Hôm nay' ? '今天'
                      : group.group_name === 'Hôm qua' ? '昨天'
                      : group.group_name === 'Tháng này' ? '本月'
                      : '更早'
                    : group.group_name}
                </h3>
                <div className="flex-1 h-px bg-[#1f1f3a]" />
                <span className="text-[10px] text-slate-600 font-semibold">{group.books.length}</span>
              </div>

              {/* Books Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.books.map((b, idx) => {
                  const ident = b.book_id || b.url;
                  const isSelected = selectedIds.has(ident);
                  return (
                    <div
                      key={ident || idx}
                      onClick={() => {
                        if (isEditMode) {
                          handleSelectItem(b);
                        } else if (b.book_id) {
                          navigate(`/book/${b.book_id}`);
                        } else if (b.url) {
                          window.open(b.url, '_blank');
                        }
                      }}
                      className={`relative bg-[#121225]/60 border rounded-2xl p-4 flex gap-3 items-start cursor-pointer transition-all hover:scale-[1.01] group ${
                        isEditMode 
                          ? 'border-purple-500/30 bg-purple-950/5' 
                          : 'border-[#1f1f3a] hover:border-brand-500/35'
                      }`}
                    >
                      {/* Selection checkbox overlay */}
                      {isEditMode && (
                        <div 
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 self-center transition-all ${
                            isSelected 
                              ? 'bg-purple-600 border-purple-500 text-white shadow shadow-purple-500/25' 
                              : 'bg-[#0b0b14] border-slate-700 text-slate-500'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </div>
                      )}

                      {/* Cover */}
                      {b.cover ? (
                        <img
                          src={b.cover}
                          alt="cover"
                          className="w-[48px] h-[66px] object-cover rounded-xl border border-[#1f1f3a] shrink-0"
                          onError={e => e.target.remove()}
                        />
                      ) : (
                        <div className="w-[48px] h-[66px] rounded-xl bg-[#0b0b14] border border-[#1f1f3a] flex items-center justify-center text-slate-600 shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-200 text-xs truncate leading-relaxed group-hover:text-brand-400 transition-colors">
                          {b.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {lang === 'vi' ? 'Tác giả' : lang === 'en' ? 'Author' : '作者'}: {b.author}
                        </p>

                        {/* Last chapter badge */}
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 bg-brand-500/10 border border-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full text-[9px] font-semibold max-w-[150px]">
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{b.last_chapter}</span>
                          </span>
                        </div>

                        {/* Date */}
                        {b.read_date && (
                          <p className="text-[9px] text-slate-600 mt-1.5">
                            {b.read_date}
                          </p>
                        )}
                      </div>

                      {/* Delete button (always visible on mobile, shows on hover on desktop) */}
                      {!isEditMode && (
                        <button
                          onClick={e => handleDeleteItem(b.book_id, b.url, e)}
                          disabled={deletingId === ident}
                          className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 disabled:opacity-50"
                          title={lang === 'vi' ? 'Xóa khỏi lịch sử' : 'Remove from history'}
                        >
                          {deletingId === ident
                            ? <Loader className="w-3.5 h-3.5 animate-spin" />
                            : <X className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </MainLayout>
  );
}

