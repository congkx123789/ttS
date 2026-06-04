import React, { useState, useEffect, useCallback, useRef } from 'react';

export default function DBSearch() {
  const [stats, setStats] = useState({ total: 0, duplicates: 0 });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [dup, setDup] = useState('');
  const [sort, setSort] = useState('relevance DESC');
  
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeHost, setActiveHost] = useState('https://tienhiep.lyvuha.com');

  const abortControllerRef = useRef(null);

  // Probe backend port and fetch stats on load
  useEffect(() => {
    const probeBackend = async () => {
      const candidates = [
        'https://tienhiep.lyvuha.com',
        'http://localhost:5051',
        'https://api.tienhiep.lyvuha.com',
        'http://localhost:5050',
        'http://localhost:5000'
      ];
      for (const host of candidates) {
        try {
          const res = await fetch(`${host}/api/stats`);
          if (res.ok) {
            const data = await res.json();
            setStats({ total: data.total, duplicates: data.duplicates });
            setActiveHost(host);
            console.log(`DBSearch: connected to backend at ${host}`);
            return;
          }
        } catch (err) {}
      }
    };
    probeBackend();
  }, []);

  // Reset page and clear books when filters or search query change
  useEffect(() => {
    setPage(1);
    setBooks([]);
  }, [query, category, source, dup, sort]);

  // Debounced search logic
  const performSearch = useCallback(async () => {
    // Abort previous pending request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      q: query,
      category: category,
      source: source,
      dup: dup,
      sort: sort,
      page: page.toString(),
      per_page: '20'
    });

    try {
      const res = await fetch(`${activeHost}/api/books?${params}`, {
        signal: controller.signal
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      
      setHasMore(data.has_more || false);
      setTotalPages(data.pages || 1);
      setTotalCount(data.total || 0);

      if (page === 1) {
        setBooks(data.books || []);
      } else {
        setBooks(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const newBooks = (data.books || []).filter(b => !existingIds.has(b.id));
          return [...prev, ...newBooks];
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Search request aborted.');
        return; // Don't reset states or show error if explicitly aborted
      }
      console.error(err);
      setError(`Không kết nối được server Web GUI (${activeHost}). Vui lòng đảm bảo server đang chạy.`);
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [query, category, source, dup, sort, page, activeHost]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [performSearch]);

  // Infinite Scroll Observer using IntersectionObserver
  useEffect(() => {
    if (!hasMore || loading) return;
    
    const container = document.querySelector('.overflow-y-auto');
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setPage(p => p + 1);
      }
    }, {
      root: container,
      rootMargin: '100px'
    });

    const sentinel = document.getElementById('search-sentinel');
    if (sentinel) observer.observe(sentinel);

    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [hasMore, loading]);

  const handleClearFilters = () => {
    setQuery('');
    setCategory('');
    setSource('');
    setDup('');
    setSort('relevance DESC');
    setPage(1);
    setBooks([]);
  };

  const parseUrls = (urlsStr) => {
    if (!urlsStr) return [];
    return urlsStr.split(' | ').map(p => {
      const idx = p.indexOf(': ');
      if (idx < 0) return null;
      return { site: p.slice(0, idx), url: p.slice(idx + 2) };
    }).filter(Boolean);
  };

  return (
    <div className="flex flex-col h-full bg-background space-y-4">
      {/* Quick Stats Block */}
      <div className="flex bg-surface-container-low rounded-xl mx-4 mt-4 p-2.5 items-center justify-around divide-x divide-outline-variant border border-outline-variant shrink-0 text-center">
        <div className="flex-1 flex flex-col items-center">
          <span className="text-sm font-bold text-primary">
            {stats.total ? Number(stats.total).toLocaleString() : '—'}
          </span>
          <span className="text-[9px] text-on-surface-variant uppercase font-semibold">Unique Novels</span>
        </div>
        <div className="flex-1 flex flex-col items-center">
          <span className="text-sm font-bold text-secondary">
            {stats.duplicates ? Number(stats.duplicates).toLocaleString() : '—'}
          </span>
          <span className="text-[9px] text-on-surface-variant uppercase font-semibold">Trùng ≥2 nguồn</span>
        </div>
      </div>

      {/* Filters & Search Inputs */}
      <div className="flex flex-col px-4 space-y-2 shrink-0">
        <div className="relative">
          <span className="absolute left-3 top-2 text-outline material-symbols-outlined text-[20px]">search</span>
          <input 
            type="text" 
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Tìm theo tên gốc, Hán Việt, tên dịch, tác giả..." 
            className="w-full h-[36px] bg-surface-container-low text-xs text-on-surface rounded-lg pl-9 pr-3 border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary-container placeholder:text-outline outline-none transition-all"
          />
        </div>

        {/* Multi-Filter Bar */}
        <div className="grid grid-cols-2 gap-2">
          <select 
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="h-[32px] bg-surface-container-low text-[11px] text-on-surface rounded-lg px-2 border border-outline-variant outline-none"
          >
            <option value="">— Tất cả thể loại —</option>
            <option value="玄幻">Huyền Huyễn</option>
            <option value="都市">Đô Thị</option>
            <option value="言情">Ngôn Tình</option>
            <option value="女生">Nữ Sinh</option>
            <option value="科幻">Khoa Huyễn</option>
            <option value="修真">Tu Chân</option>
            <option value="仙侠">Tiên Hiệp</option>
            <option value="武侠">Võ Hiệp</option>
            <option value="军事">Quân Sự</option>
            <option value="历史">Lịch Sử</option>
            <option value="网游">Võng Du</option>
            <option value="同人">Đồng Nhân</option>
            <option value="其他">Khác</option>
          </select>

          <select 
            value={source}
            onChange={(e) => { setSource(e.target.value); setPage(1); }}
            className="h-[32px] bg-surface-container-low text-[11px] text-on-surface rounded-lg px-2 border border-outline-variant outline-none"
          >
            <option value="">— Tất cả nguồn —</option>
            <option value="Ixdzs">Ixdzs</option>
            <option value="Biquge">Biquge</option>
            <option value="41nr">41nr</option>
            <option value="Quanben">Quanben</option>
            <option value="Faloo">Faloo</option>
            <option value="Fanqie">Fanqie</option>
            <option value="Hjwzw">Hjwzw</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <select 
            value={dup}
            onChange={(e) => { setDup(e.target.value); setPage(1); }}
            className="h-[30px] bg-surface-container-low text-[11px] text-on-surface rounded-lg px-1.5 border border-outline-variant outline-none"
          >
            <option value="">Trùng lặp: Tất cả</option>
            <option value="multi">Trùng ≥2 nguồn</option>
            <option value="single">Chỉ 1 nguồn</option>
          </select>

          <select 
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="h-[30px] bg-surface-container-low text-[11px] text-on-surface rounded-lg px-1.5 border border-outline-variant outline-none"
          >
            <option value="relevance DESC">Phù hợp nhất</option>
            <option value="site_count DESC">Nhiều nguồn</option>
            <option value="chapters_max DESC">Nhiều chương</option>
            <option value="title ASC">Tên A-Z</option>
            <option value="id ASC">Mặc định</option>
          </select>

          <button 
            onClick={handleClearFilters}
            className="h-[30px] bg-surface-container-low border border-outline-variant rounded-lg text-[11px] font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
          >
            ✕ Xóa lọc
          </button>
        </div>
      </div>

      {/* Results Header */}
      <div className="px-4 text-[10px] text-outline font-semibold shrink-0">
        {totalCount > 0 ? `Tìm thấy ${totalCount.toLocaleString()} đầu sách` : `Đã hiển thị ${books.length} kết quả`}
      </div>

      {/* Scrollable Results list */}
      <div className="flex-1 overflow-y-auto px-4 pb-[76px] custom-scrollbar">
        {loading && books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <span className="material-symbols-outlined animate-spin text-[28px] text-primary">sync</span>
            <span className="text-xs text-on-surface-variant animate-pulse font-medium">Đang tìm kiếm...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-error-container text-on-error-container rounded-xl text-xs text-center border border-error/20">
            {error}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-10 text-xs text-outline">
            Không tìm thấy truyện nào phù hợp.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {books.map((b, idx) => {
              const urls = parseUrls(b.urls);
              return (
                <div 
                  key={idx}
                  className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex gap-3 hover:border-primary/40 hover:shadow-sm transition-all items-center md:items-start"
                >
                  {/* Book Cover or PlaceHolder */}
                  {b.cover ? (
                    <img 
                      src={b.cover} 
                      alt={b.title}
                      onError={(e) => { e.target.style.display = 'none'; }}
                      className="w-[45px] h-[60px] md:w-[60px] md:h-[80px] object-cover rounded bg-surface-container border border-outline-variant shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-[45px] h-[60px] md:w-[60px] md:h-[80px] rounded bg-surface-container flex items-center justify-center text-outline text-[20px] md:text-[24px] font-bold shrink-0 border border-outline-variant select-none">
                      📖
                    </div>
                  )}

                  {/* Book Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full min-h-[60px] md:min-h-[80px]">
                    <div>
                      <h4 className="text-xs md:text-sm lg:text-base font-bold text-on-surface line-clamp-1 leading-tight flex items-center flex-wrap gap-1.5">
                        {b.matched_title_type && (
                          <span className="text-[8px] md:text-[10px] font-extrabold px-1.5 py-0.2 bg-primary/10 text-primary border border-primary/20 rounded uppercase shrink-0">
                            {b.matched_title_type === 'hanviet' ? 'Hán Việt' : b.matched_title_type === 'vietphrase' ? 'Advanced' : b.matched_title_type === 'fast' ? 'Fast' : 'Gốc'}
                          </span>
                        )}
                        <span className="truncate">{b.matched_title_content || b.title_vietphrase || b.title_adv || b.title_hv || b.title}</span>
                      </h4>
                      <p className="text-[10px] md:text-xs text-outline mt-1 line-clamp-2 leading-relaxed">
                        Hán Việt: {b.title_hv || b.title_hanviet || '—'} <br className="hidden md:inline" /> Vietphrase: {b.title_fast || b.title_vietphrase || '—'} <br className="hidden md:inline" /> Gốc: {b.title}
                      </p>
                      <p className="text-[10px] md:text-xs text-secondary font-semibold mt-1">
                        ✍ {b.author_hanviet || b.author || '—'}
                      </p>
                    </div>

                    {/* Metadata and Link Badges */}
                    <div className="flex flex-wrap gap-1 items-center mt-2">
                      {b.relevance !== undefined && b.relevance > 0 && (
                        <span className="text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20 rounded flex items-center gap-0.5">
                          ⭐ {Math.min(Math.round(b.relevance), 10)}/10
                        </span>
                      )}
                      {b.site_count > 1 && (
                        <span className="text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border border-yellow-500/20 rounded">
                          🔗 {b.site_count} nguồn
                        </span>
                      )}
                      {b.chapters_max && (
                        <span className="text-[8px] md:text-[10px] font-medium px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                          📚 {b.chapters_max} ch
                        </span>
                      )}
                      {urls.slice(0, 3).map((u, ui) => (
                        <a 
                          key={ui}
                          href={u.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[8px] md:text-[10px] font-semibold px-1.5 py-0.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-blue-600 rounded transition-colors"
                        >
                          {u.site} ↗
                        </a>
                      ))}
                      {urls.length > 3 && (
                        <span className="text-[8px] md:text-[10px] text-outline">
                          +{urls.length - 3} nguồn khác
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Sentinel for Infinite scroll loading */}
            {hasMore && (
              <div id="search-sentinel" className="col-span-full h-[40px] flex items-center justify-center text-xs text-outline font-medium py-2">
                <span className="animate-spin mr-1.5 font-bold">↻</span> Đang tải thêm kết quả...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
