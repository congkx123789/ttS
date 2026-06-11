import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import BookCard from '../components/BookCard';
import AudioPlayer from '../components/AudioPlayer';
import api from '../services/api';
import { BookMarked, Search, Loader, Trash2, CheckSquare, Square, Edit3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Bookshelf() {
  const { t, lang } = useLang();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [books, setBooks] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  // Bulk Edit States
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState(new Set());

  // Floating Audio player states
  const [activeAudioBook, setActiveAudioBook] = useState(null);

  // Translation Comparison States
  const [comparingBookId, setComparingBookId] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [compLoading, setCompLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      setLoading(false);
      return;
    }
    fetchBookshelf();
  }, [user, authLoading, q]);

  const fetchBookshelf = async () => {
    setLoading(true);
    try {
      const params = q ? { q } : {};
      const res = await api.get('/api/bookshelf', { params });
      // Map return fields
      const mapped = res.data.map(b => ({
        id: b.book_id || b.url,
        title_vietphrase: b.title,
        author_hanviet: b.author,
        cover: b.cover,
        url: b.url,
        site_count: 1
      }));
      setBooks(mapped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBook = (bookId) => {
    setSelectedBookIds(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedBookIds.size === books.length) {
      setSelectedBookIds(new Set());
    } else {
      setSelectedBookIds(new Set(books.map(b => b.id).filter(Boolean)));
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = window.confirm(
      lang === 'vi' 
        ? `Bạn có chắc chắn muốn xóa ${selectedBookIds.size} truyện đã chọn khỏi tủ sách cá nhân không?`
        : lang === 'en'
          ? `Are you sure you want to remove ${selectedBookIds.size} selected novels from bookshelf?`
          : `您确定要从书架中移出选中的 ${selectedBookIds.size} 部小说吗？`
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      await Promise.all(
        Array.from(selectedBookIds).map(id => {
          if (typeof id === 'string' && (id.startsWith('http://') || id.startsWith('https://'))) {
            return api.post('/api/bookshelf/remove', { url: id });
          } else {
            return api.post('/api/bookshelf/remove', { book_id: id });
          }
        })
      );
      setSelectedBookIds(new Set());
      setIsEditMode(false);
      await fetchBookshelf();
    } catch (e) {
      alert(lang === 'vi' ? 'Không xóa được sách hàng loạt.' : 'Failed to perform bulk remove.');
    } finally {
      setLoading(true); // Will trigger refresh immediately, keep loading state consistent
      await fetchBookshelf();
    }
  };

  const handleToggleFav = async (bookId) => {
    const confirmed = window.confirm(
      lang === 'vi'
        ? 'Bạn có chắc chắn muốn xóa truyện này khỏi tủ sách cá nhân không?'
        : lang === 'en'
          ? 'Are you sure you want to remove this novel from your personal bookshelf?'
          : '您确定要从个人书架中移出这部小说吗？'
    );
    if (!confirmed) return;
    try {
      if (typeof bookId === 'string' && (bookId.startsWith('http://') || bookId.startsWith('https://'))) {
        await api.post('/api/bookshelf/remove', { url: bookId });
      } else {
        await api.post('/api/bookshelf/remove', { book_id: bookId });
      }
      setBooks(prev => prev.filter(b => b.id !== bookId));
    } catch (e) {
      alert(lang === 'vi' ? 'Không xóa được sách.' : lang === 'en' ? 'Failed to remove novel.' : '无法移出书架。');
    }
  };

  const handleSearchAuthor = (authorName) => {
    navigate(`/?search_field=author&q=${encodeURIComponent(authorName)}`);
  };

  const handleSearchCategory = (categoryName) => {
    navigate(`/?category=${encodeURIComponent(categoryName)}`);
  };

  const handleRead = (book) => {
    if (book.id) {
      navigate(`/book/${book.id}`);
    }
  };

  const handleCompare = async (bookId) => {
    if (comparingBookId === bookId) {
      setComparingBookId(null);
      setComparisonData(null);
      return;
    }
    setComparingBookId(bookId);
    setCompLoading(true);
    try {
      const res = await api.get(`/api/book/${bookId}/translations`);
      setComparisonData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setCompLoading(false);
    }
  };

  const handlePlayTrailer = async (book) => {
    if (!book.description) {
      try {
        const res = await api.get(`/api/book/${book.id}/translations`);
        if (res.data) {
          const matchedDesc = res.data.advanced?.desc || res.data.fast?.desc || res.data.vietphrase?.desc || '';
          setActiveAudioBook({
            ...book,
            description: matchedDesc
          });
        } else {
          setActiveAudioBook(book);
        }
      } catch (e) {
        setActiveAudioBook(book);
      }
    } else {
      setActiveAudioBook(book);
    }
  };

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
          <p className="text-sm">{t.loginToViewBookshelf}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookMarked className="w-6 h-6 text-brand-400" />
            {lang === 'vi' ? 'Tủ Sách Cá Nhân' : lang === 'en' ? 'Personal Bookshelf' : '个人书架'} ({books.length})
          </h2>

          {books.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  setSelectedBookIds(new Set());
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  isEditMode
                    ? 'bg-purple-600/25 border-purple-500/50 text-purple-300 hover:bg-purple-600/35'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {isEditMode 
                  ? (lang === 'vi' ? 'Thoát quản lý' : 'Exit management') 
                  : (lang === 'vi' ? 'Quản lý tủ sách' : 'Manage bookshelf')}
              </button>

              {isEditMode && (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 bg-[#121225] border border-[#1f1f3a] rounded-lg text-xs font-bold text-slate-300 hover:bg-[#1a1a35] transition-all"
                  >
                    {selectedBookIds.size === books.length 
                      ? (lang === 'vi' ? 'Hủy chọn tất cả' : 'Deselect all') 
                      : (lang === 'vi' ? 'Chọn tất cả' : 'Select all')}
                  </button>

                  {selectedBookIds.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-rose-950/20 transition-all active:scale-95 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {lang === 'vi' ? `Xóa hàng loạt (${selectedBookIds.size})` : `Bulk Delete (${selectedBookIds.size})`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder={lang === 'vi' ? 'Tìm trong tủ sách...' : lang === 'en' ? 'Search bookshelf...' : '在书架中搜索...'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#121225] border border-[#1f1f3a] rounded-xl text-white outline-none focus:border-brand-500 transition-colors text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500">
          <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
          <span>{t.loading}</span>
        </div>
      ) : books.length === 0 ? (
        <div className="py-20 text-center text-slate-500 bg-[#121225]/40 border border-dashed border-[#1f1f3a] rounded-2xl">
          <BookMarked className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm">{lang === 'vi' ? 'Tủ sách trống. Hãy thêm truyện từ tab Khám Phá!' : lang === 'en' ? 'Bookshelf is empty. Add novels from Discover tab!' : '书架空空如也。请从“发现”选项卡中添加小说！'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {books.map(b => {
            const isSelected = selectedBookIds.has(b.id);
            return (
              <div key={b.id || b.url} className="flex flex-col relative group">
                {isEditMode && (
                  <div 
                    onClick={() => handleSelectBook(b.id)}
                    className={`absolute top-3 left-3 z-30 w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-all shadow-md ${
                      isSelected 
                        ? 'bg-purple-600 border-purple-500 text-white shadow-purple-500/20' 
                        : 'bg-[#0f101f]/95 border-slate-700/80 text-slate-500 hover:bg-purple-950/25 hover:border-purple-500/50'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4.5 h-4.5" />
                    ) : (
                      <Square className="w-4.5 h-4.5" />
                    )}
                  </div>
                )}

                <div className={isEditMode ? 'opacity-70 transition-opacity' : ''}>
                  <BookCard 
                    book={b}
                    isFav={true}
                    onToggleFav={handleToggleFav}
                    onRead={handleRead}
                    onCompare={handleCompare}
                    onPlayTrailer={handlePlayTrailer}
                    onSearchAuthor={handleSearchAuthor}
                    onSearchCategory={handleSearchCategory}
                  />
                </div>

                {comparingBookId === b.id && (
                  <div className="bg-[#0f101f] border border-[#1f1f3a] rounded-b-2xl p-4 text-xs mt-[-10px] space-y-4 shadow-inner">
                    {compLoading ? (
                      <div className="text-center text-slate-500 py-3">{t.comparingText}</div>
                    ) : comparisonData ? (
                      <>
                        <div className="pb-2 border-b border-white/5">
                          <span className="text-[10px] text-brand-400 font-extrabold uppercase">{t.compFast}</span>
                          <div className="text-white font-bold mt-0.5">{comparisonData.fast.title || '—'}</div>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-1">{comparisonData.fast.desc || '—'}</p>
                        </div>
                        <div className="pb-2 border-b border-white/5">
                          <span className="text-[10px] text-amber-400 font-extrabold uppercase">{t.compAdvanced}</span>
                          <div className="text-white font-bold mt-0.5">{comparisonData.advanced.title || '—'}</div>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-1">{comparisonData.advanced.desc || '—'}</p>
                        </div>
                        <div className="pb-2 border-b border-white/5">
                          <span className="text-[10px] text-emerald-400 font-extrabold uppercase">{t.compVietphrase}</span>
                          <div className="text-white font-bold mt-0.5">{comparisonData.vietphrase.title || '—'}</div>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-1">{comparisonData.vietphrase.desc || '—'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-indigo-400 font-extrabold uppercase">{t.compHanviet}</span>
                          <div className="text-white font-bold mt-0.5">{comparisonData.hanviet.title || '—'}</div>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-1">{comparisonData.hanviet.desc || '—'}</p>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-red-500 py-3">{t.compError}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Audio Trailer Player */}
      {activeAudioBook && (
        <AudioPlayer 
          book={activeAudioBook} 
          onClose={() => setActiveAudioBook(null)} 
        />
      )}
    </MainLayout>
  );
}
