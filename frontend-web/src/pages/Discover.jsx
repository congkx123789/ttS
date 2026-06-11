import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import BookCard from '../components/BookCard';
import AiUpgradeModal from '../components/AiUpgradeModal';
import AudioPlayer from '../components/AudioPlayer';
import api from '../services/api';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, Filter, RefreshCw, X, ShieldAlert, Award, 
  Volume2, Globe, Sparkles, ChevronLeft, ChevronRight, 
  Flame, MessageSquare, Shuffle 
} from 'lucide-react';

export default function Discover() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const getCategoryName = (cat) => {
    if (!cat) return t.allCategories;
    const catMap = {
      "玄幻": lang === 'vi' ? 'Huyền Huyễn' : lang === 'en' ? 'Fantasy' : '玄幻',
      "都市": lang === 'vi' ? 'Đô Thị' : lang === 'en' ? 'Urban' : '都市',
      "言情": lang === 'vi' ? 'Ngôn Tình' : lang === 'en' ? 'Romance' : '言情',
      "女生": lang === 'vi' ? 'Nữ Sinh' : lang === 'en' ? 'Female Lead' : '女生',
      "科幻": lang === 'vi' ? 'Khoa Huyễn' : lang === 'en' ? 'Sci-Fi' : '科幻',
      "修真": lang === 'vi' ? 'Tu Chân' : lang === 'en' ? 'Cultivation' : '修真',
      "仙侠": lang === 'vi' ? 'Tiên Hiệp' : lang === 'en' ? 'Xianxia' : '仙侠',
      "武侠": lang === 'vi' ? 'Võ Hiệp' : lang === 'en' ? 'Wuxia' : '武侠',
      "历史": lang === 'vi' ? 'Lịch Sử' : lang === 'en' ? 'History' : '历史',
      "网游": lang === 'vi' ? 'Võng Du' : lang === 'en' ? 'Gaming' : '网游',
      "同人": lang === 'vi' ? 'Đồng Nhân' : lang === 'en' ? 'Fanfiction' : '同人',
      "其他": lang === 'vi' ? 'Thể loại khác' : lang === 'en' ? 'Others' : '其他',
    };
    return catMap[cat] || cat;
  };

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search and Filter States
  const [q, setQ] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [dup, setDup] = useState('');
  const [minChapters, setMinChapters] = useState('');
  const [sortBy, setSortBy] = useState('site_count DESC');
  const [showFilters, setShowFilters] = useState(false);


  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Stats
  const [stats, setStats] = useState({ total: 931427, duplicates: 0 });

  // Comparison Panel State
  const [comparingBookId, setComparingBookId] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [compLoading, setCompLoading] = useState(false);

  // Bookshelf IDs for marking cards
  const [bookshelfIds, setBookshelfIds] = useState(new Set());

  // Top/Leaderboard Novels
  const [leaderboard, setLeaderboard] = useState([]);

  // UI Enhancement States
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [activeAudioBook, setActiveAudioBook] = useState(null);
  
  // Hero Slider State
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroTranslateMode, setHeroTranslateMode] = useState('original'); // 'original', 'vi', 'en'
  const [heroTranslatedDesc, setHeroTranslatedDesc] = useState('');
  const [heroTranslating, setHeroTranslating] = useState(false);

  // Custom static Featured books for Hero Banner
  const [heroBooks, setHeroBooks] = useState([
    {
      id: 1,
      title: "Hắc Ám Văn Minh",
      title_vietphrase: "Hắc Ám Văn Minh",
      author: "Cổ Hi",
      author_hanviet: "Cổ Hi",
      categories: "Huyền Huyễn, Mạt Thế, Khoa Huyễn",
      cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60",
      description: "Khi bóng tối bao phủ địa cầu, nhân loại đối mặt với kỷ nguyên hắc ám tột cùng. Các nguồn văn minh bị phá hủy hoàn toàn, những loài thú biến dị trỗi dậy, kẻ mạnh mới có quyền sinh tồn..."
    },
    {
      id: 2,
      title: "Đấu Phá Thương Khung",
      title_vietphrase: "Đấu Phá Thương Khung",
      author: "Thiên Tàm Thổ Đậu",
      author_hanviet: "Thiên Tàm Thổ Đậu",
      categories: "Tiên Hiệp, Huyền Huyễn",
      cover: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=200&auto=format&fit=crop&q=60",
      description: "Nơi đây là thế giới của Đấu Khí. Không có ma pháp hoa lệ, chỉ có đấu khí sinh sôi phát triển đến đỉnh phong! Tiêu Viêm - một thiên tài bỗng chốc sa sút, bắt đầu cuộc hành trình nghịch thiên cải mệnh..."
    },
    {
      id: 3,
      title: "Hộc Châu Phu Nhân",
      title_vietphrase: "Hộc Châu Phu Nhân",
      author: "Tiêu Như Sắt",
      author_hanviet: "Tiêu Như Sắt",
      categories: "Ngôn Tình, Cổ Đại, Nữ Sinh",
      cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=200&auto=format&fit=crop&q=60",
      description: "Nơi Giao Châu xa xôi có bộ tộc mò ngọc trai quý hiếm. Cuộc đời nàng Diệp Hải Thị xoay vần giữa tranh đoạt quyền lực nơi cung đình triều đình đại chiến và mối tình đầy ngang trái..."
    }
  ]);

  // Community Comments Mock
  const communityComments = [
    {
      id: 1,
      user: "Minh Quân",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=60",
      source: "Metruyenchu",
      comment: "bên nguồn chữ một cho màn Trong 😂",
      time: "2 phút trước"
    },
    {
      id: 2,
      user: "Thanh Trúc",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=60",
      source: "Truyenchu",
      comment: "bên thảo của màn Trong 😆",
      time: "1 phút trước"
    },
    {
      id: 3,
      user: "Quốc Bảo",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=60",
      source: "Nady knise",
      comment: "trên đàn nên to...",
      time: "1 phút trước"
    },
    {
      id: 4,
      user: "Lan Hương",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&auto=format&fit=crop&q=60",
      source: "Metruyenchu",
      comment: "(Tốt) chặn khỉn hồi Uanb u oại thi mượt 😮",
      time: "1 phút trước"
    }
  ];

  useEffect(() => {
    fetchStats();
    loadBookshelf();
  }, [user]);

  useEffect(() => {
    const urlQ = searchParams.get('q');
    const urlField = searchParams.get('search_field');
    const urlCat = searchParams.get('category');
    
    let needsFetch = false;
    let initialOverrides = {};

    if (urlQ) {
      setQ(urlQ);
      initialOverrides.q = urlQ;
      needsFetch = true;
    }
    if (urlField) {
      setSearchField(urlField);
      initialOverrides.search_field = urlField;
      needsFetch = true;
    }
    if (urlCat) {
      setCategory(urlCat);
      initialOverrides.category = urlCat;
      needsFetch = true;
    }

    if (needsFetch) {
      fetchBooks(initialOverrides);
      setSearchParams({}, { replace: true });
    } else {
      fetchBooks();
    }
  }, [searchParams]);

  useEffect(() => {
    // Check if searchParams are empty to prevent duplicate initial fetches
    const hasParams = searchParams.get('q') || searchParams.get('search_field') || searchParams.get('category');
    if (!hasParams) {
      fetchBooks();
    }
  }, [page, category, source, dup, minChapters, sortBy]);

  // Load real database items to match custom featured list where possible
  useEffect(() => {
    const syncHeroBooks = async () => {
      try {
        const synced = [...heroBooks];
        for (let i = 0; i < synced.length; i++) {
          const res = await api.get('/api/books', {
            params: { q: synced[i].title, per_page: 1 }
          });
          if (res.data && res.data.books && res.data.books.length > 0) {
            const match = res.data.books[0];
            synced[i] = {
              ...synced[i],
              id: match.id,
              cover: match.cover || synced[i].cover,
              title_vietphrase: match.title_vietphrase || match.title,
              author_hanviet: match.author_hanviet || match.author,
              urls: match.urls,
              categories: match.categories || synced[i].categories
            };
          }
        }
        setHeroBooks(synced);
      } catch (e) {
        console.error("Failed to sync hero books with database:", e);
      }
    };
    syncHeroBooks();
  }, []);

  // Reset translate mode when hero index changes
  useEffect(() => {
    setHeroTranslateMode('original');
    setHeroTranslatedDesc('');
  }, [heroIndex]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/api/stats');
      setStats({
        total: res.data.total_books || 931427,
        duplicates: res.data.duplicates || 0
      });
    } catch (e) {
      console.error(e);
    }
  };

  const loadBookshelf = async () => {
    if (!user) {
      setBookshelfIds(new Set());
      return;
    }
    try {
      const res = await api.get('/api/bookshelf');
      setBookshelfIds(new Set(res.data.map(b => b.book_id)));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBooks = async (overrideParams = {}) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        q: overrideParams.q !== undefined ? overrideParams.q : q,
        category: overrideParams.category !== undefined ? overrideParams.category : category,
        source: overrideParams.source !== undefined ? overrideParams.source : source,
        dup: overrideParams.dup !== undefined ? overrideParams.dup : dup,
        sort: sortBy,
        search_field: overrideParams.search_field !== undefined ? overrideParams.search_field : searchField,
        min_chapters: minChapters,
        page,
        per_page: 30
      };
      const res = await api.get('/api/books', { params });
      setBooks(res.data.books || []);
      setTotalPages(res.data.pages || 1);
      setTotal(res.data.total || 0);

      // Create static/real hybrid leaderboard matching screenshot
      if (res.data.books && page === 1 && !category && !source && !q) {
        const list = [
          { id: 1, title: 'Hắc Ám Văn Minh', author: 'Cổ Hi', trend: 'up', diff: 1 },
          { id: 2, title: 'Hộc ẩm chúa tể', author: 'Linh Hạ Cửu Thập Độ', trend: 'up', diff: 2 },
          { id: 3, title: '10 Lần Thôn Tương', author: 'Luân Hồi Thiên Trọng', trend: 'down', diff: 1 },
          { id: 4, title: 'Mộ Ngôn', author: 'Nguôn', trend: 'none', diff: 0 }
        ];
        setLeaderboard(list);
      }
    } catch (err) {
      setError(err.response?.data?.error || t.connError);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchAuthor = (authorName) => {
    setSearchField('author');
    setQ(authorName);
    setPage(1);
    fetchBooks({ search_field: 'author', q: authorName });
  };

  const handleSearchCategory = (categoryName) => {
    setCategory(categoryName);
    setPage(1);
    fetchBooks({ category: categoryName });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBooks();
  };

  const handleRead = (book) => {
    if (book.id) {
      navigate(`/book/${book.id}`);
    }
  };

  const handleToggleFav = async (bookId) => {
    if (!user) {
      alert("Vui lòng đăng nhập để lưu sách.");
      return;
    }
    const inShelf = bookshelfIds.has(bookId);
    const url = inShelf ? '/api/bookshelf/remove' : '/api/bookshelf/add';
    try {
      await api.post(url, { book_id: bookId });
      setBookshelfIds(prev => {
        const next = new Set(prev);
        if (inShelf) next.delete(bookId);
        else next.add(bookId);
        return next;
      });
    } catch (e) {
      alert(e.response?.data?.error || 'Lỗi xử lý tủ sách.');
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
      await api.post('/api/history/add', { book_id: bookId, last_chapter: 'Đang xem so sánh' });
    } catch (e) {
      console.error(e);
    } finally {
      setCompLoading(false);
    }
  };

  const handleClearFilters = () => {
    setQ('');
    setSearchField('all');
    setCategory('');
    setSource('');
    setDup('');
    setMinChapters('');
    setSortBy('site_count DESC');
    setPage(1);
  };

  const handleRandomGacha = async () => {
    setLoading(true);
    try {
      const randomPage = Math.floor(Math.random() * 20) + 1;
      const res = await api.get('/api/books', { params: { page: randomPage, per_page: 30 } });
      if (res.data && res.data.books && res.data.books.length > 0) {
        const randomIdx = Math.floor(Math.random() * res.data.books.length);
        const selected = res.data.books[randomIdx];
        setBooks([selected]);
        setTotalPages(1);
        setTotal(1);
        setActiveAudioBook(selected);
      }
    } catch (e) {
      console.error("Gacha failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const translateHeroDescription = async (targetLang) => {
    const activeHero = heroBooks[heroIndex];
    if (targetLang === 'original') {
      setHeroTranslateMode('original');
      return;
    }
    setHeroTranslating(true);
    try {
      const res = await api.post('/api/translate', {
        texts: [activeHero.description],
        mode: targetLang === 'en' ? 'en' : 'vietphrase'
      });
      if (res.data && res.data.translations && res.data.translations[0]) {
        setHeroTranslatedDesc(res.data.translations[0]);
        setHeroTranslateMode(targetLang);
      }
    } catch (e) {
      alert("Hạn mức dịch máy chủ đã hết hoặc có lỗi xảy ra.");
    } finally {
      setHeroTranslating(false);
    }
  };

  const handlePlayHeroTrailer = () => {
    const activeHero = heroBooks[heroIndex];
    setActiveAudioBook(activeHero);
  };

  const handleSelectAiBook = (selectedBook) => {
    setBooks([selectedBook]);
    setTotalPages(1);
    setTotal(1);
  };

  const activeHero = heroBooks[heroIndex];
  const heroDescription = heroTranslateMode === 'original' 
    ? activeHero.description 
    : (heroTranslatedDesc || activeHero.description);

  return (
    <MainLayout stats={stats}>
      {/* Hero Banner Section */}
      <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden mb-6 min-h-[220px] sm:min-h-[360px] bg-[#0b0b14] border border-[#1f1f3a]/80 shadow-2xl flex flex-col justify-end">
        {/* Background Image with Cover */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-700" 
          style={{ backgroundImage: `url('/hero_banner.png')` }}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b14] via-[#0b0b14]/75 to-transparent" />
        
        {/* Banner Content */}
        <div className="relative z-10 p-4 sm:p-8 md:p-12 max-w-2xl text-left space-y-2 sm:space-y-4 self-start">
          <h2 className="text-lg sm:text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-amber-200 tracking-wide uppercase">
            {lang === 'vi' ? 'TRUYỆN ĐỀ CỬ XUẤT SẮC TUẦN NÀY' : lang === 'en' ? 'WEEKLY FEATURED NOVEL' : '本周精选推荐'}
          </h2>
          <h3 className="text-base sm:text-xl md:text-2xl font-bold text-white tracking-wide">
            {activeHero.title_vietphrase}
          </h3>
          <p className="text-slate-400 text-xs mt-1 hidden sm:block">
            ✍ {lang === 'vi' ? 'Tác giả:' : lang === 'en' ? 'Author:' : '作者:'} <strong className="text-brand-300 font-semibold">{activeHero.author_hanviet}</strong> · {lang === 'vi' ? 'Thể loại:' : lang === 'en' ? 'Categories:' : '题材:'} <span className="text-slate-300 font-medium">{activeHero.categories}</span>
          </p>

          <p className="text-slate-300 text-xs leading-relaxed line-clamp-2 sm:line-clamp-3 bg-[#0b0b14]/60 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-white/5">
            {heroTranslating ? (lang === 'vi' ? "Đang dịch nội dung..." : lang === 'en' ? "Translating content..." : "正在翻译内容...") : heroDescription}
          </p>

          <div className="flex flex-wrap gap-2 sm:gap-4 pt-1 sm:pt-2">
            <button 
              onClick={handlePlayHeroTrailer}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-extrabold px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg transition-all text-xs"
            >
              {lang === 'vi' ? 'Nghe Tóm Tắt (TTS)' : lang === 'en' ? 'Listen Summary (TTS)' : '听取大纲 (TTS)'} <span className="text-purple-300">| 🔊</span>
            </button>
            
            {/* Dịch Nhanh flags */}
            <div className="inline-flex items-center gap-1.5 bg-[#121225]/80 border border-white/10 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs font-bold">
              <span className="text-slate-400 text-[10px] hidden sm:inline">{lang === 'vi' ? 'Dịch Nhanh' : lang === 'en' ? 'Quick Translate' : '快速翻译'}</span>
              <button onClick={() => translateHeroDescription('vi')} className="hover:scale-115 transition-transform" title="Thuần Việt">🇻🇳</button>
              <button onClick={() => translateHeroDescription('en')} className="hover:scale-115 transition-transform" title="English">🇺🇸</button>
              <button onClick={() => translateHeroDescription('original')} className="hover:scale-115 transition-transform" title="Original Chinese">🇨🇳</button>
            </div>
          </div>
        </div>

        {/* Carousel Slider controls & dots */}
        <div className="absolute right-8 bottom-8 z-10 flex items-center gap-3">
          <button 
            onClick={() => setHeroIndex(prev => (prev - 1 + heroBooks.length) % heroBooks.length)}
            className="p-2 bg-black/50 hover:bg-black/75 rounded-full border border-white/10 text-white transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex gap-1.5">
            {heroBooks.map((_, idx) => (
              <button 
                key={idx}
                onClick={() => setHeroIndex(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${heroIndex === idx ? 'bg-purple-500 w-6' : 'bg-white/20'}`}
              />
            ))}
          </div>

          <button 
            onClick={() => setHeroIndex(prev => (prev + 1) % heroBooks.length)}
            className="p-2 bg-black/50 hover:bg-black/75 rounded-full border border-white/10 text-white transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid structure: Left side filters/books, Right side Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main section */}
        <div className="lg:col-span-3 space-y-6">
          {/* Controls Bar */}
          <form onSubmit={handleSearchSubmit} className="bg-[#121225]/80 border border-[#1f1f3a]/80 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <input 
                  type="text" 
                  placeholder={t.searchPlaceholder}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-white outline-none focus:border-purple-500 transition-colors text-xs"
                />
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <button 
                  type="submit" 
                  className="flex-1 sm:flex-initial bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-3 rounded-xl shadow-md transition-all text-xs text-center"
                >
                  {lang === 'vi' ? 'Tìm' : lang === 'en' ? 'Search' : '搜索'}
                </button>

                <button 
                  type="button" 
                  onClick={() => setShowFilters(v => !v)}
                  className={`px-3 py-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    showFilters 
                      ? 'bg-purple-600/20 border-purple-500/40 text-purple-300' 
                      : 'bg-[#0b0b14] border-[#1f1f3a] text-slate-400 hover:text-white'
                  }`}
                  title={lang === 'vi' ? 'Bộ lọc nâng cao' : lang === 'en' ? 'Advanced filters' : '高级筛选'}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">{lang === 'vi' ? 'Bộ lọc' : lang === 'en' ? 'Filters' : '筛选'}</span>
                </button>

                {/* AI Upgrade button */}
                <button 
                  type="button" 
                  onClick={() => setAiModalOpen(true)}
                  className="flex-1 sm:flex-initial bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-[#0b0b14] font-extrabold px-4 py-3 rounded-xl shadow-lg transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 fill-current animate-pulse" />
                  <span>{lang === 'vi' ? 'AI' : lang === 'en' ? 'AI Search' : 'AI'}</span>
                </button>
              </div>
            </div>

            <div className={`${showFilters ? 'grid' : 'hidden lg:grid'} grid-cols-2 md:grid-cols-3 gap-3 pt-2`}>
              <select 
                value={searchField} 
                onChange={(e) => setSearchField(e.target.value)}
                className="bg-[#0b0b14] border border-[#1f1f3a] text-xs font-semibold rounded-xl p-3 text-slate-300 outline-none cursor-pointer focus:border-purple-500"
              >
                <option value="all">{t.searchFieldAll}</option>
                <option value="title">{t.searchFieldTitle}</option>
                <option value="author">{t.searchFieldAuthor}</option>
                <option value="hanviet">{t.searchFieldHanviet}</option>
                <option value="vietphrase">{t.searchFieldVietphrase}</option>
                <option value="chinese">{t.searchFieldChinese}</option>
                <option value="description">{t.searchFieldDesc}</option>
              </select>

              <select 
                value={category} 
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="bg-[#0b0b14] border border-[#1f1f3a] text-xs font-semibold rounded-xl p-3 text-slate-300 outline-none cursor-pointer focus:border-purple-500"
              >
                <option value="">{t.allCategories}</option>
                {["玄幻", "都市", "言情", "女生", "科幻", "修真", "仙侠", "武侠", "历史", "网游", "同人", "其他"].map(cat => (
                  <option key={cat} value={cat}>{getCategoryName(cat)}</option>
                ))}
              </select>

              <select 
                value={source} 
                onChange={(e) => { setSource(e.target.value); setPage(1); }}
                className="bg-[#0b0b14] border border-[#1f1f3a] text-xs font-semibold rounded-xl p-3 text-slate-300 outline-none cursor-pointer focus:border-purple-500"
              >
                <option value="">{t.allSources}</option>
                {['Ixdzs', 'Biquge', '41nr', 'Quanben', 'Faloo', 'Fanqie', 'Hjwzw'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select 
                value={dup} 
                onChange={(e) => { setDup(e.target.value); setPage(1); }}
                className="bg-[#0b0b14] border border-[#1f1f3a] text-xs font-semibold rounded-xl p-3 text-slate-300 outline-none cursor-pointer focus:border-purple-500"
              >
                <option value="">{t.allDup}</option>
                <option value="multi">{t.dupMulti}</option>
                <option value="single">{t.dupSingle}</option>
              </select>

              <select 
                value={minChapters} 
                onChange={(e) => { setMinChapters(e.target.value); setPage(1); }}
                className="bg-[#0b0b14] border border-[#1f1f3a] text-xs font-semibold rounded-xl p-3 text-slate-300 outline-none cursor-pointer focus:border-purple-500"
              >
                <option value="">{t.allChapters}</option>
                <option value="100">{t.ch100}</option>
                <option value="500">{t.ch500}</option>
                <option value="1000">{t.ch1000}</option>
                <option value="2000">{t.ch2000}</option>
              </select>

              <select 
                value={sortBy} 
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                className="bg-[#0b0b14] border border-[#1f1f3a] text-xs font-semibold rounded-xl p-3 text-slate-300 outline-none cursor-pointer focus:border-purple-500"
              >
                <option value="site_count DESC">{t.sortBy.site_count}</option>
                <option value="chapters_max DESC">{t.sortBy.chapters_max}</option>
                <option value="word_count_max DESC">{t.sortBy.word_count_max}</option>
                <option value="title ASC">{t.sortBy.title_asc}</option>
                <option value="title DESC">{t.sortBy.title_desc}</option>
                <option value="id ASC">{t.sortBy.default}</option>
              </select>
            </div>

            <div className="flex justify-between items-center border-t border-[#1f1f3a]/30 pt-3">
              <span className="text-slate-500 text-xs">
                {lang === 'vi' ? <>Tìm thấy <strong>{total.toLocaleString()}</strong> truyện</> : lang === 'en' ? <>Found <strong>{total.toLocaleString()}</strong> novels</> : <>找到 <strong>{total.toLocaleString()}</strong> 部小说</>}
              </span>
              
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleRandomGacha}
                  className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors text-xs font-extrabold"
                >
                  <Shuffle className="w-3.5 h-3.5" /> {lang === 'vi' ? 'Random Truyện (Gacha)' : lang === 'en' ? 'Random Novel (Gacha)' : '随机小说 (抽卡)'}
                </button>

                <button 
                  type="button" 
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-xs font-bold"
                >
                  <X className="w-3.5 h-3.5" /> {t.clearFilter}
                </button>
              </div>
            </div>
          </form>

          {/* Books Grid */}
          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-brand-500" />
              <span>{t.loading}</span>
            </div>
          ) : error ? (
            <div className="py-20 text-center text-red-500">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-red-400" />
              <span>{error}</span>
            </div>
          ) : books.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <Search className="w-10 h-10 mx-auto mb-3" />
              <span>{t.empty}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {books.map(b => (
                <div key={b.id} className="flex flex-col">
                  <BookCard 
                     book={b}
                     isFav={bookshelfIds.has(b.id)}
                     onToggleFav={handleToggleFav}
                     onCompare={handleCompare}
                     onPlayTrailer={setActiveAudioBook}
                     onSearchAuthor={handleSearchAuthor}
                     onSearchCategory={handleSearchCategory}
                     onRead={handleRead}
                  />

                  {/* Dynamic Comparison Panel matches screenshot third card exactly */}
                  {comparingBookId === b.id && (
                    <div className="bg-[#0f101f] border border-[#1f1f3a] rounded-b-2xl p-4 text-xs mt-[-10px] space-y-4 shadow-inner">
                      {compLoading ? (
                        <div className="text-center text-slate-500 py-3">{t.comparingText}</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] text-slate-300">
                            <thead>
                              <tr className="border-b border-[#2d2d55] text-slate-400 font-bold">
                                <th className="pb-2">{lang === 'vi' ? 'Chỉ số' : lang === 'en' ? 'Metric' : '指标'}</th>
                                <th className="pb-2">{lang === 'vi' ? 'Điểm số' : lang === 'en' ? 'Score' : '评分'}</th>
                                <th className="pb-2">{lang === 'vi' ? 'Nguồn tiêu biểu' : lang === 'en' ? 'Best Source' : '推荐站'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1f1f3a]">
                              <tr>
                                <td className="py-2 font-semibold text-slate-400">{lang === 'vi' ? 'Tốc độ cập nhật' : lang === 'en' ? 'Update Speed' : '更新速度'}</td>
                                <td className="py-2 text-emerald-400 font-bold">4.8</td>
                                <td className="py-2 text-slate-300">Metruyenchu <span className="text-slate-500 text-[10px]">31 votes</span></td>
                              </tr>
                              <tr>
                                <td className="py-2 font-semibold text-slate-400">{lang === 'vi' ? 'Quảng cáo & Sạch' : lang === 'en' ? 'Ads & Cleanliness' : '广告与排版'}</td>
                                <td className="py-2 text-emerald-400 font-bold">4.9</td>
                                <td className="py-2 text-slate-300">TruyenFull <span className="text-slate-500 text-[10px]">81 votes</span></td>
                              </tr>
                              <tr>
                                <td className="py-2 font-semibold text-slate-400">{lang === 'vi' ? 'Độ chuẩn bản dịch' : lang === 'en' ? 'Translation Standard' : '翻译准确度'}</td>
                                <td className="py-2 text-emerald-400 font-bold">4.7</td>
                                <td className="py-2 text-slate-300">MeDoc <span className="text-slate-500 text-[10px]">63 votes</span></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center gap-2 pt-6">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-[#121225] border border-[#1f1f3a] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-500 hover:text-white transition-all text-xs font-semibold"
              >
                &laquo; {lang === 'vi' ? 'Trước' : lang === 'en' ? 'Prev' : '上一页'}
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = page;
                if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;

                if (p < 1 || p > totalPages) return null;

                return (
                  <button 
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg border text-xs font-semibold transition-all ${
                      page === p 
                        ? 'bg-purple-600 border-purple-600 text-white shadow-md' 
                        : 'bg-[#121225] border-[#1f1f3a] hover:bg-white/5 text-slate-400'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-[#121225] border border-[#1f1f3a] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-500 hover:text-white transition-all text-xs font-semibold"
              >
                {lang === 'vi' ? 'Sau' : lang === 'en' ? 'Next' : '下一页'} &raquo;
              </button>
            </div>
          )}
        </div>

        {/* Sidebar widgets */}
        <div className="space-y-6">
          {/* Leaderboard */}
          <div className="bg-[#121225]/60 border border-[#1f1f3a] rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-amber-400" /> {lang === 'vi' ? 'BẢNG XẾP HẠNG HOT' : lang === 'en' ? 'HOT RANKINGS' : '热门排行'}
            </h3>

            {leaderboard.length > 0 ? (
              <div className="space-y-4">
                {leaderboard.map((novel, index) => (
                  <div key={novel.id} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 shadow-md ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-300 to-amber-500 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800' :
                        index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                        'bg-white/5 text-slate-400 border border-white/10'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-200 truncate">{novel.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">✍ {novel.author}</p>
                      </div>
                    </div>
                    {/* Rank indicator matches screenshot */}
                    <div className="flex items-center gap-1 text-[10px] shrink-0 font-bold">
                      {novel.trend === 'up' && (
                        <span className="text-emerald-500 flex items-center">▲ {novel.diff}</span>
                      )}
                      {novel.trend === 'down' && (
                        <span className="text-red-500 flex items-center">▼ {novel.diff}</span>
                      )}
                      {novel.trend === 'none' && (
                        <span className="text-slate-500">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-xs text-center py-6">{lang === 'vi' ? 'Chưa có xếp hạng.' : lang === 'en' ? 'No rankings.' : '暂无排行'}</p>
            )}
          </div>

          {/* Community Activities */}
          <div className="bg-[#121225]/60 border border-[#1f1f3a]/85 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-purple-300 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-400" /> {lang === 'vi' ? 'Hoạt động cộng đồng' : lang === 'en' ? 'Community Activity' : '社区动态'}
            </h3>

            {/* Avatars row */}
            <div className="flex -space-x-2 overflow-hidden py-1 border-b border-white/5 pb-3">
              {communityComments.map(c => (
                <img
                  key={c.id}
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-[#121225] object-cover"
                  src={c.avatar}
                  alt={c.user}
                />
              ))}
            </div>

            <div className="space-y-4">
              {communityComments.map((c) => {
                let badgeColor = 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400';
                if (c.source === 'Truyenchu') badgeColor = 'bg-sky-500/15 border-sky-500/35 text-sky-400';
                if (c.source === 'Nady knise') badgeColor = 'bg-purple-500/15 border-purple-500/35 text-purple-400';
                
                return (
                  <div key={c.id} className="border-b border-white/5 pb-3.5 last:border-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 text-xs font-bold">{c.user}</span>
                      </div>
                      <span className="text-slate-500 text-[10px]">{c.time}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase shrink-0 ${badgeColor}`}>
                        {c.source}
                      </span>
                      <p className="text-slate-300 text-xs leading-normal flex-1">
                        {c.comment}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* AI Upgrade Search Modal */}
      <AiUpgradeModal 
        isOpen={aiModalOpen} 
        onClose={() => setAiModalOpen(false)} 
        onSelectBook={handleSelectAiBook}
      />

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
