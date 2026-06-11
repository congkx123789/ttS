import React, { useState } from 'react';
import { useLang } from '../contexts/LangContext';
import { useNavigate } from 'react-router-dom';
import { Book, Star, Columns, Volume2, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import api from '../services/api';

export default function BookCard({ 
  book, 
  isFav, 
  onToggleFav, 
  onCompare, 
  onRead, 
  onPlayTrailer,
  onSearchAuthor,
  onSearchCategory
}) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [showDesc, setShowDesc] = useState(false);
  const [translateMode, setTranslateMode] = useState('original'); // 'original', 'vi', 'en'
  const [translatedDesc, setTranslatedDesc] = useState('');
  const [translating, setTranslating] = useState(false);

  const parseUrls = (urlsStr) => {
    if (!urlsStr) return [];
    return urlsStr.split(' | ').map(p => {
      const idx = p.indexOf(': ');
      if (idx < 0) return null;
      return { site: p.slice(0, idx), url: p.slice(idx + 2) };
    }).filter(Boolean);
  };

  // Logic ngôn ngữ cho các trường truyện
  const displayTitle = (() => {
    if (lang === 'zh' || lang === 'en') {
      return book.title || '—';
    }
    const viT = book.title_vietphrase || book.title_hanviet;
    if (viT && book.title && viT !== book.title) {
      return `${viT} (${book.title})`;
    }
    return viT || book.title || '—';
  })();

  const displayAuthor = (() => {
    if (lang === 'zh') {
      return book.author || '—';
    }
    if (lang === 'en') {
      return book.author_english || book.author || '—';
    }
    return book.author_hanviet || book.author || '—';
  })();

  const rawDesc = (() => {
    if (lang === 'zh') {
      return book.description || '';
    }
    if (lang === 'en') {
      return book.description_english || book.description || '';
    }
    return book.description_vietphrase || book.description || '';
  })();

  const descText = translateMode === 'original' ? rawDesc : (translatedDesc || rawDesc);
  const urlsList = parseUrls(book.urls);

  const getEmotionTags = () => {
    const cats = book.categories || '';
    if (cats.includes('玄幻') || cats.includes('修真') || cats.includes('仙侠') || cats.includes('Huyền Huyện') || cats.includes('Tiên Hiệp')) {
      return ['Sát phạt', 'Vô địch'];
    }
    if (cats.includes('都市') || cats.includes('历史') || cats.includes('Đô Thị') || cats.includes('Lịch Sử') || cats.includes('Văn Minh') || cats.includes('Văn minh')) {
      return ['Hài hước', 'Trí tuệ'];
    }
    return ['Hài hước', 'Trí tuệ'];
  };

  const handleTranslateDesc = async (targetLang) => {
    if (targetLang === 'original') {
      setTranslateMode('original');
      return;
    }
    setTranslating(true);
    try {
      const res = await api.post('/api/translate', {
        texts: [rawDesc],
        mode: targetLang === 'en' ? 'en' : 'vietphrase'
      });
      if (res.data && res.data.translations && res.data.translations[0]) {
        setTranslatedDesc(res.data.translations[0]);
        setTranslateMode(targetLang);
      }
    } catch (e) {
      alert("Hạn mức dịch máy chủ đã hết.");
    } finally {
      setTranslating(false);
    }
  };

  const categoriesSource = (() => {
    if (lang === 'zh') {
      return book.categories || '';
    }
    if (lang === 'en') {
      return book.categories_english || book.categories || '';
    }
    return book.categories_vietphrase || book.categories || '';
  })();

  const categoriesList = categoriesSource
    ? categoriesSource.split(/[,，/、\s]+/).map(c => c.trim()).filter(Boolean)
    : [];



  return (
    <div className="bg-[#121225]/85 border border-[#1f1f3a] rounded-xl p-3.5 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 flex flex-col justify-between relative overflow-visible min-h-[300px]">
      <div>
        <div className="flex gap-3">
          {book.cover ? (
            <img 
              src={book.cover} 
              alt="cover" 
              className="w-[60px] h-[82px] object-cover rounded-lg border border-[#2d2d55] shadow-md shrink-0 bg-[#0f0f1a]"
              onError={(e) => { e.target.remove(); }}
            />
          ) : (
            <div className="w-[60px] h-[82px] rounded-lg border border-[#2d2d55] bg-[#0f0f1a] flex items-center justify-center text-slate-500 shrink-0 shadow-md">
              <Book className="w-5 h-5" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <h3 
                className="text-slate-100 font-bold text-xs hover:text-purple-400 transition-colors cursor-pointer flex-1 whitespace-normal break-words line-clamp-2" 
                onClick={() => onRead && onRead(book)}
                title={displayTitle}
              >
                {displayTitle}
              </h3>
              
              {/* Play Audio Button */}
              {rawDesc && (
                <button
                  onClick={() => onPlayTrailer && onPlayTrailer(book)}
                  className="p-1 rounded bg-[#1f1f3a] hover:bg-purple-600 hover:text-white text-purple-400 transition-colors shrink-0"
                  title="Nghe tóm tắt AI (TTS)"
                >
                  <Volume2 className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
              <div className="whitespace-normal break-words">
                Tác giả: <span 
                  onClick={() => {
                    const authorName = book.author || book.author_hanviet || displayAuthor;
                    if (authorName && authorName !== '—') {
                      navigate(`/author/${encodeURIComponent(authorName)}`);
                    }
                  }}
                  className="text-purple-400 hover:text-purple-300 cursor-pointer underline hover:no-underline font-semibold"
                  title="Xem hồ sơ tác giả"
                >
                  {displayAuthor}
                </span>
              </div>
              <div className="whitespace-normal break-words line-clamp-1">
                Gốc: <span className="text-slate-400">{book.title || '—'}</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                {book.site_count || 5} nguồn
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                {book.site_count || 5} site
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                {book.word_count_max ? Math.round(book.word_count_max / 1000) : 1975}
              </span>
            </div>
          </div>
        </div>

        {/* Categories Row */}
        {categoriesList.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5 items-center">
            <span className="text-slate-500 text-[9px]">Thể loại:</span>
            {categoriesList.map((cat, idx) => (
              <span
                key={idx}
                onClick={() => onSearchCategory && onSearchCategory(cat)}
                className="cursor-pointer px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-400 text-[8px] font-semibold transition-colors"
                title={`Lọc thể loại ${cat}`}
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center text-slate-400 text-[10px] mt-2.5 border-t border-[#1f1f3a]/40 pt-2">
          <span>
            <strong>Chương:</strong> {book.chapters_max || 110} | {book.word_count_max ? Math.round(book.word_count_max / 1000) : 0}
          </span>
          {rawDesc && (
            <button
              onClick={() => setShowDesc(!showDesc)}
              className="text-slate-500 hover:text-purple-400 text-[9px] flex items-center gap-0.5 font-bold transition-colors"
            >
              {showDesc ? (
                <>Ẩn tóm tắt <ChevronUp className="w-2.5 h-2.5" /></>
              ) : (
                <>Hiện tóm tắt <ChevronDown className="w-2.5 h-2.5" /></>
              )}
            </button>
          )}
        </div>

        {/* Description & Translation controls (Collapsible) */}
        {showDesc && rawDesc && (
          <div className="mt-2.5 bg-[#0b0b14]/50 p-2 rounded-lg border border-[#1a1a2e] transition-all duration-300">
            <div className="flex justify-between items-center mb-1 text-[9px] text-slate-500">
              <span>Tóm tắt:</span>
              <div className="flex gap-1">
                <button 
                  onClick={() => handleTranslateDesc('original')}
                  className={`px-1 py-0.5 rounded text-[8px] font-bold ${translateMode === 'original' ? 'bg-purple-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}
                >
                  Gốc
                </button>
                <button 
                  onClick={() => handleTranslateDesc('vi')}
                  className={`px-1 py-0.5 rounded text-[8px] font-bold ${translateMode === 'vi' ? 'bg-purple-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}
                  disabled={translating}
                >
                  🇻🇳
                </button>
                <button 
                  onClick={() => handleTranslateDesc('en')}
                  className={`px-1 py-0.5 rounded text-[8px] font-bold ${translateMode === 'en' ? 'bg-purple-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}
                  disabled={translating}
                >
                  🇺🇸
                </button>
              </div>
            </div>
            <p className="text-slate-400 text-[10px] line-clamp-3 leading-relaxed" title={rawDesc}>
              {translating ? "Đang dịch tóm tắt..." : descText}
            </p>
          </div>
        )}

        {/* Emotion Tags */}
        <div className="flex gap-1.5 items-center mt-2.5 text-[9px]">
          <span className="text-slate-500">Cảm xúc:</span>
          {getEmotionTags().map((tag, idx) => (
            <span key={idx} className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 font-extrabold text-[8px]">
              {tag}
            </span>
          ))}
        </div>

        {/* Reading Sources List */}
        <div className="mt-2.5 relative">
          <div className="flex flex-wrap gap-1">
            {urlsList.map((u, i) => {
              let logoColor = 'bg-emerald-500 text-white';
              if (u.site.toLowerCase().includes('biquge') || u.site.toLowerCase().includes('full') || u.site.toLowerCase().includes('truyenfull')) {
                logoColor = 'bg-sky-500 text-white';
              } else if (u.site.toLowerCase().includes('faloo') || u.site.toLowerCase().includes('vcomi') || u.site.toLowerCase().includes('fanqie')) {
                logoColor = 'bg-orange-500 text-white';
              } else if (u.site.toLowerCase().includes('quanben') || u.site.toLowerCase().includes('hjwzw')) {
                logoColor = 'bg-purple-500 text-white';
              }
              
              return (
                <a 
                  key={i} 
                  href={u.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="inline-flex items-center gap-1 bg-[#0b0b14]/40 border border-[#1f1f3a] hover:border-purple-500/30 rounded px-1.5 py-0.5 text-[9px] text-slate-300 hover:text-white transition-all"
                >
                  <span className={`w-3 h-3 rounded flex items-center justify-center text-[8px] font-extrabold ${logoColor}`}>
                    {u.site[0]}
                  </span>
                  {u.site}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3 pt-2 border-t border-[#1f1f3a]/20">
        <button 
          onClick={() => onCompare && onCompare(book.id)}
          className="flex-1 inline-flex items-center justify-center gap-1 bg-transparent border border-purple-500/30 text-purple-400 hover:bg-purple-600/10 py-2.5 sm:py-1.5 rounded-lg text-[10px] font-bold transition-all min-h-[36px]"
        >
          <Columns className="w-3 h-3" /> So sánh bản dịch
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFav && onToggleFav(book.id); }}
          className={`px-3 py-2.5 sm:px-2 sm:py-1.5 border rounded-lg text-[10px] font-semibold transition-all min-h-[36px] ${
            isFav 
              ? 'bg-amber-400 border-amber-400 text-[#0b0b14]' 
              : 'bg-amber-400/5 border-amber-400/30 text-amber-400 hover:bg-amber-400/15'
          }`}
          title={isFav ? t.removeExternal : t.addBookshelf}
        >
          <Star className="w-3.5 h-3.5 fill-current" />
        </button>
      </div>
    </div>
  );
}
