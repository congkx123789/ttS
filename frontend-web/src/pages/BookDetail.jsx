import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import api from '../services/api';
import { 
  Book, Star, Play, ChevronDown, ChevronUp, Loader, 
  MessageSquare, ThumbsUp, Send, CheckCircle2, Eye, Award, Zap, ExternalLink, Share2, X
} from 'lucide-react';

export default function BookDetail() {
  const { bookId } = useParams();
  const { user } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [shareMessage, setShareMessage] = useState('');
  const [sharing, setSharing] = useState(false);


  useEffect(() => {
    if (shareOpen && user) {
      api.get('/api/friends/list')
        .then(res => {
          if (res.data && res.data.friends) {
            setFriends(res.data.friends);
          }
        })
        .catch(err => console.error("Failed to load friends for sharing", err));
    }
  }, [shareOpen, user]);

  const handleShareBook = async (friendId) => {
    setSharing(true);
    try {
      const res = await api.post('/api/books/share', {
        friend_id: friendId,
        book_id: book.id,
        message: shareMessage
      });
      if (res.data && res.data.success) {
        alert(lang === 'vi' ? 'Đã chia sẻ thành công!' : 'Shared successfully!');
        setShareOpen(false);
        setShareMessage('');
      }
    } catch (e) {
      alert('Chia sẻ thất bại.');
    } finally {
      setSharing(false);
    }
  };
  const [isFav, setIsFav] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [chaptersLoading, setChaptersLoading] = useState(true);

  // Comments State
  const [comments, setComments] = useState([
    {
      id: 1,
      user: 'Lê Hoàng Nam',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=60',
      rating: 5,
      text: 'Bản dịch AI của trang này chuẩn thật sự, đọc Hán Việt rất mượt mà. Mong nhóm update chương mới nhanh hơn nữa!',
      time: '2 giờ trước',
      likes: 12
    },
    {
      id: 2,
      user: 'Nguyễn Thu Thảo',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=60',
      rating: 4,
      text: 'Truyện hay, cốt truyện sát phạt quyết đoán đúng gu mình. Bản dịch máy thỉnh thoảng có vài từ Hán Việt chưa dịch nghĩa kỹ nhưng tổng thể vẫn rất dễ hiểu.',
      time: '5 giờ trước',
      likes: 8
    },
    {
      id: 3,
      user: 'Trần Minh Đức',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=60',
      rating: 5,
      text: 'So sánh bản dịch Metruyenchu với trang này thì bản ở đây sạch QC hơn nhiều. Giao diện đọc truyện tối ưu tốt trên di động.',
      time: '1 ngày trước',
      likes: 19
    }
  ]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentRating, setNewCommentRating] = useState(5);
  const [likedComments, setLikedComments] = useState(new Set());

  useEffect(() => {
    fetchBookDetails();
    fetchChaptersList();
    checkIfFavorite();
  }, [bookId, user]);

  // Auto-log: ghi lịch sử xem khi mở trang (silent, không block UI)
  const logReadingHistory = async (loadedBook) => {
    if (!user || !loadedBook) return;
    try {
      await api.post('/api/history/add', {
        book_id: loadedBook.id,
        last_chapter: lang === 'vi' ? 'Đang xem' : lang === 'en' ? 'Viewing' : '浏览中'
      });
    } catch (e) {
      // silent - không hiển thị lỗi cho user
    }
  };

  const fetchBookDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/book/${bookId}`);
      if (res.data) {
        setBook(res.data);
        logReadingHistory(res.data);
      }
    } catch (e) {
      // Fallback search matching or translation detail endpoint
      try {
        const res = await api.get('/api/books', { params: { q: '', page: 1, per_page: 100 } });
        const found = res.data.books.find(b => b.id === parseInt(bookId));
        if (found) {
          setBook(found);
          logReadingHistory(found);
        } else {
          const detailRes = await api.get(`/api/book/${bookId}/translations`);
          if (detailRes.data) {
            const fallbackBook = {
              id: parseInt(bookId),
              title_vietphrase: detailRes.data.vietphrase.title,
              title: detailRes.data.hanviet.title,
              description_vietphrase: detailRes.data.vietphrase.desc,
              author_hanviet: lang === 'vi' ? 'Tác giả' : lang === 'en' ? 'Author' : '作者',
              cover: '',
              parsed_sources: []
            };
            setBook(fallbackBook);
            logReadingHistory(fallbackBook);
          }
        }
      } catch (innerErr) {
        setError(lang === 'vi' ? 'Không tải được thông tin truyện.' : lang === 'en' ? 'Failed to load book details.' : '无法加载小说详情。');
      }
    } finally {
      setLoading(false);
    }
  };

  const getParsedSources = () => {
    if (!book) return [];
    const list = [];
    if (book.parsed_sources && book.parsed_sources.length > 0) {
      book.parsed_sources.forEach(src => {
        list.push({ site: src.source, url: src.url });
      });
    } else if (book.urls) {
      const parts = book.urls.split(" | ");
      for (const p of parts) {
        const idx = p.indexOf(":");
        if (idx > 0) {
          list.push({
            site: p.substring(0, idx).trim(),
            url: p.substring(idx + 1).trim()
          });
        }
      }
    }
    return list;
  };

  const urlsList = getParsedSources();

  const fetchChaptersList = async () => {
    setChaptersLoading(true);
    try {
      // Mock loading chapters from 1 to 50 for the demo book reader context
      const list = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: lang === 'vi' ? `Chương ${i + 1}: Tiết tử và khởi nguyên` : lang === 'en' ? `Chapter ${i + 1}: Prologue` : `第 ${i + 1} 章: 楔子与起源`,
        url_idx: i + 1
      }));
      setChapters(list);
    } catch (e) {
      console.error(e);
    } finally {
      setChaptersLoading(false);
    }
  };

  const checkIfFavorite = async () => {
    if (!user) return;
    try {
      const res = await api.get('/api/bookshelf');
      const found = res.data.some(b => b.book_id === parseInt(bookId));
      setIsFav(found);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFav = async () => {
    if (!user) {
      alert(lang === 'vi' ? "Vui lòng đăng nhập để lưu sách." : lang === 'en' ? "Please log in to save books." : "请先登录以收藏小说。");
      return;
    }
    const url = isFav ? '/api/bookshelf/remove' : '/api/bookshelf/add';
    try {
      await api.post(url, { book_id: parseInt(bookId) });
      setIsFav(!isFav);
    } catch (e) {
      alert(lang === 'vi' ? 'Lỗi cập nhật tủ sách.' : lang === 'en' ? 'Error updating bookshelf.' : '更新书架时出错。');
    }
  };

  const handleLikeComment = (commentId) => {
    setLikedComments(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
        setComments(comments.map(c => c.id === commentId ? { ...c, likes: c.likes - 1 } : c));
      } else {
        next.add(commentId);
        setComments(comments.map(c => c.id === commentId ? { ...c, likes: c.likes + 1 } : c));
      }
      return next;
    });
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const commentObj = {
      id: Date.now(),
      user: user ? (user.name || user.email.split('@')[0]) : (lang === 'vi' ? 'Khách vãng lai' : lang === 'en' ? 'Guest user' : '访客'),
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=60',
      rating: newCommentRating,
      text: newCommentText,
      time: lang === 'vi' ? 'Vừa xong' : lang === 'en' ? 'Just now' : '刚刚',
      likes: 0
    };

    setComments([commentObj, ...comments]);
    setNewCommentText('');
    setNewCommentRating(5);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="py-20 text-center text-slate-500">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-500" />
          <span>{lang === 'vi' ? 'Đang tải thông tin truyện...' : lang === 'en' ? 'Loading book details...' : '正在加载小说信息...'}</span>
        </div>
      </MainLayout>
    );
  }

  if (error || !book) {
    return (
      <MainLayout>
        <div className="py-20 text-center text-red-500 font-bold">
          {error || (lang === 'vi' ? 'Không tìm thấy truyện.' : lang === 'en' ? 'Book not found.' : '未找到小说。')}
        </div>
      </MainLayout>
    );
  }

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

  const displayDescription = (() => {
    if (lang === 'zh') {
      return book.description || 'Chưa có tóm tắt.';
    }
    if (lang === 'en') {
      return book.description_english || book.description || 'No synopsis available.';
    }
    return book.description_vietphrase || book.description || 'Chưa có tóm tắt.';
  })();

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
    <MainLayout>
      {/* Blurred Backdrop Cover Header */}
      <div className="relative rounded-3xl overflow-hidden border border-[#1f1f3a] mb-8 bg-[#0b0b14]/70 p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center md:items-start z-0">
        {book.cover && (
          <div 
            className="absolute inset-0 z-[-1] opacity-15 blur-2xl scale-110 bg-cover bg-center" 
            style={{ backgroundImage: `url(${book.cover})` }}
          />
        )}

        {book.cover ? (
          <img 
            src={book.cover} 
            alt="cover" 
            className="w-[120px] md:w-[150px] h-[165px] md:h-[210px] object-cover rounded-xl border-2 border-[#1f1f3a]/80 shadow-2xl shrink-0" 
          />
        ) : (
          <div className="w-[120px] md:w-[150px] h-[165px] md:h-[210px] bg-[#121225] border-2 border-[#1f1f3a]/80 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
            <Book className="w-12 h-12" />
          </div>
        )}

        <div className="flex-1 min-w-0 text-center md:text-left space-y-3">
          <h2 className="text-xl md:text-2xl font-black text-white leading-tight">
            {displayTitle}
          </h2>
          {lang === 'vi' && (
            <p className="text-slate-400 text-xs font-semibold">
              Hán Việt: {book.title_hanviet || '—'} · Gốc Trung: {book.title}
            </p>
          )}
          <p className="text-purple-400 text-sm md:text-base font-bold">
            ✍ {lang === 'vi' ? 'Tác giả' : lang === 'en' ? 'Author' : '作者'}:{' '}
            <span 
              onClick={() => {
                const authorName = book.author || book.author_hanviet;
                if (authorName && authorName !== '—') {
                  navigate(`/author/${encodeURIComponent(authorName)}`);
                }
              }} 
              className="cursor-pointer hover:underline text-purple-300 font-extrabold hover:text-purple-400 transition-colors"
            >
              {displayAuthor}
            </span>
          </p>

          <div className="flex flex-wrap justify-center md:justify-start gap-2 py-1">
            {categoriesList.map((cat, idx) => (
              <span key={idx} className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full text-xs font-semibold">
                {cat}
              </span>
            ))}
          </div>

          {/* Nguồn truyện gốc */}
          {urlsList && urlsList.length > 0 && (
            <div className="flex flex-col gap-1.5 py-1 text-left">
              <span className="text-slate-500 text-[10px] font-bold block">
                {lang === 'vi' ? 'Nguồn gốc:' : 'Sources:'}
              </span>
              <div className="flex flex-wrap gap-1.5 relative">
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
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 bg-[#0b0b14]/40 border border-[#1f1f3a] hover:border-purple-500/30 rounded px-2 py-1 text-[10px] text-slate-300 hover:text-white transition-all hover:scale-[1.02]"
                      title={u.url}
                    >
                      <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-extrabold ${logoColor}`}>{u.site[0]}</span>
                      {u.site}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-3">
            <button 
              onClick={() => navigate(`/book/${book.id}/read/1`)}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-lg shadow-purple-500/20 hover:brightness-105 active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-current" /> {lang === 'vi' ? 'Bắt đầu đọc' : lang === 'en' ? 'Start Reading' : '开始阅读'}
            </button>
            <button 
              onClick={handleToggleFav}
              className={`inline-flex items-center gap-1.5 px-6 py-3 rounded-xl text-xs font-bold transition-all border ${
                isFav 
                  ? 'bg-amber-400 border-amber-400 text-[#0b0b14]' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
              }`}
            >
              <Star className="w-4 h-4 fill-current" />
              {isFav ? (lang === 'vi' ? 'Đã lưu vào tủ' : lang === 'en' ? 'Saved in Shelf' : '已收藏') : (lang === 'vi' ? 'Thêm vào tủ' : lang === 'en' ? 'Save to Shelf' : '收藏')}
            </button>
            {urlsList && urlsList.length > 0 && (
              <a 
                href={urlsList[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-6 py-3 bg-[#0b0b14]/50 border border-purple-500/30 hover:bg-purple-500/10 text-purple-300 rounded-xl text-xs font-bold transition-all hover:scale-[1.02]"
              >
                <ExternalLink className="w-4 h-4" />
                {lang === 'vi' ? 'Trang gốc (Web thật)' : 'Source Web'}
              </a>
            )}
            {user && (
              <button 
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-1.5 px-6 py-3 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 text-purple-200 rounded-xl text-xs font-bold transition-all hover:scale-[1.02]"
              >
                <Share2 className="w-4 h-4" />
                {lang === 'vi' ? 'Chia sẻ với bạn bè' : 'Share with Friends'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left 2/3 Content Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Book Synopsis Section */}
          <div className="bg-[#121225]/60 border border-[#1f1f3a] rounded-3xl p-6">
            <h3 className="text-base font-extrabold text-white mb-3">Tóm tắt nội dung</h3>
            <div className="text-slate-300 text-xs leading-relaxed space-y-2 relative">
              <p className={expandedDesc ? '' : 'line-clamp-4'}>
                {displayDescription}
              </p>
              {displayDescription && (
                <button 
                  onClick={() => setExpandedDesc(!expandedDesc)}
                  className="mt-2 text-purple-400 font-bold inline-flex items-center gap-1 text-[11px] hover:underline"
                >
                  {expandedDesc ? (
                    <>Thu gọn <ChevronUp className="w-3.5 h-3.5" /></>
                  ) : (
                    <>Xem thêm <ChevronDown className="w-3.5 h-3.5" /></>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Chapters list index */}
          <div className="bg-[#121225]/60 border border-[#1f1f3a] rounded-3xl p-6">
            <h3 className="text-base font-extrabold text-white mb-4">Danh sách chương</h3>
            {chaptersLoading ? (
              <div className="text-center text-slate-500 py-6">Đang tải danh sách chương...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                {chapters.map(chap => (
                  <button 
                    key={chap.id}
                    onClick={() => navigate(`/book/${book.id}/read/${chap.url_idx}`)}
                    className="text-left px-4 py-3 bg-[#0b0b14]/50 hover:bg-purple-500/10 border border-[#1f1f3a] hover:border-purple-500/30 rounded-xl text-xs text-slate-300 hover:text-purple-300 transition-all truncate"
                  >
                    {chap.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reader Reviews & Comments Section */}
          <div className="bg-[#121225]/60 border border-[#1f1f3a] rounded-3xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-[#1f1f3a]/60 pb-4">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <MessageSquare className="w-4.5 h-4.5 text-purple-400" /> Bình luận & Đánh giá ({comments.length})
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold text-sm">⭐ 4.8</span>
                <span className="text-slate-500 text-[11px]">(145 bình chọn)</span>
              </div>
            </div>

            {/* Comment Submission Form */}
            <form onSubmit={handleAddComment} className="bg-[#0b0b14]/40 border border-[#1f1f3a] p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold">Viết nhận xét của bạn:</span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500 mr-1">Đánh giá sao:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewCommentRating(star)}
                      className={`text-sm transition-colors ${
                        star <= newCommentRating ? 'text-amber-400' : 'text-slate-600 hover:text-slate-500'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Nhập cảm nhận của bạn về bản dịch, cốt truyện..."
                  rows="3"
                  className="w-full bg-[#121225] border border-[#1f1f3a] rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-purple-500/50 transition-colors resize-none placeholder-slate-600"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/30 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  <Send className="w-3.5 h-3.5" /> Gửi bình luận
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="border-b border-[#1f1f3a]/40 pb-4 last:border-b-0 last:pb-0 flex gap-3.5">
                  <img
                    src={comment.avatar}
                    alt={comment.user}
                    className="w-9 h-9 rounded-full object-cover border border-[#2d2d55] bg-[#0f0f1a] shrink-0"
                  />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100">{comment.user}</span>
                        <div className="flex text-amber-400 text-[10px]">
                          {Array.from({ length: 5 }, (_, i) => (
                            <span key={i}>{i < comment.rating ? '★' : '☆'}</span>
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500">{comment.time}</span>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed">{comment.text}</p>
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => handleLikeComment(comment.id)}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                          likedComments.has(comment.id) ? 'text-purple-400' : 'text-slate-500 hover:text-slate-400'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" /> Hữu ích ({comment.likes})
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>

        {/* Right 1/3 Sidebar Column */}
        <div className="space-y-6">
          
          {/* Translation Stats Card */}
          <div className="bg-[#121225]/60 border border-[#1f1f3a] rounded-3xl p-6 space-y-5">
            <h3 className="text-sm font-extrabold text-white border-b border-[#1f1f3a] pb-2.5 flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-400" /> Thống kê & Chi tiết
            </h3>
            
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Trạng thái:
                </span>
                <span className="text-emerald-400 font-bold">Đang cập nhật</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-purple-400" /> Tổng lượt xem:
                </span>
                <span className="text-slate-200 font-bold">
                  {book.word_count_max ? Math.round(book.word_count_max * 1.5).toLocaleString() : '340,500'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-400" /> Tốc độ ra chương:
                </span>
                <span className="text-slate-200 font-bold">~12 chương / ngày</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-purple-400" /> Độ tin cậy nguồn:
                </span>
                <span className="text-indigo-400 font-bold">99.1% (Sạch QC)</span>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-[#1f1f3a]/30">
                <span className="text-slate-500 text-xs flex items-center gap-1.5">
                  <Book className="w-3.5 h-3.5 text-purple-400" /> Đọc ở trang gốc (Web thật):
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {urlsList && urlsList.length > 0 ? (
                    urlsList.map((src, idx) => {
                      let logoColor = 'bg-emerald-500 text-white';
                      if (src.site.toLowerCase().includes('biquge') || src.site.toLowerCase().includes('full') || src.site.toLowerCase().includes('truyenfull')) {
                        logoColor = 'bg-sky-500 text-white';
                      } else if (src.site.toLowerCase().includes('faloo') || src.site.toLowerCase().includes('vcomi') || src.site.toLowerCase().includes('fanqie')) {
                        logoColor = 'bg-orange-500 text-white';
                      } else if (src.site.toLowerCase().includes('quanben') || src.site.toLowerCase().includes('hjwzw')) {
                        logoColor = 'bg-purple-500 text-white';
                      }
                      return (
                        <a 
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-[#0b0b14]/50 border border-[#1f1f3a] hover:border-purple-500/40 rounded px-2 py-1 text-[10px] text-slate-300 hover:text-purple-300 transition-all hover:scale-[1.02]"
                          title={src.url}
                        >
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-black ${logoColor}`}>
                            {src.site[0]}
                          </span>
                          {src.site}
                          <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                        </a>
                      );
                    })
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">Metruyenchu, Biquge (Không tìm thấy link)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Translation Engine Badge */}
          <div className="bg-gradient-to-br from-purple-900/35 to-indigo-950/40 border border-purple-500/20 rounded-3xl p-6 text-center space-y-3.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center mx-auto text-purple-400">
              <Zap className="w-5 h-5 fill-current animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white">Dịch thuật bởi Antigravity AI</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Ứng dụng bộ dịch thuật mạng nơ-ron nâng cao giúp chuyển ngữ chính xác ngữ cảnh Hán Việt sang Việt ngữ.
              </p>
            </div>
          </div>

        </div>

      </div>
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0c0d1e] border border-purple-500/35 rounded-3xl p-6 w-full max-w-sm text-slate-100 shadow-2xl relative animate-fadeIn">
            <button 
              onClick={() => { setShareOpen(false); setShareMessage(''); }}
              className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-extrabold text-sm tracking-wider uppercase mb-4 text-purple-300">Chia sẻ truyện</h3>
            
            <div className="space-y-3">
              <label className="block text-[10px] uppercase font-black tracking-widest text-slate-500">Lời nhắn kèm theo</label>
              <input 
                type="text" 
                placeholder="Ví dụ: Truyện này hay lắm, đọc đi!"
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                className="w-full px-3 py-2 bg-[#080814] border border-purple-500/20 rounded-xl text-xs text-white outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-2 mt-4">
              <label className="block text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Chọn bạn bè</label>
              {friends.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-purple-500/10 rounded-2xl text-xs text-slate-500">
                  Chưa có bạn bè nào. Vui lòng kết bạn trước.
                </div>
              ) : (
                <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {friends.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-2 hover:bg-purple-950/20 border border-purple-500/10 rounded-xl">
                      <span className="text-xs font-bold text-slate-200">{f.username}</span>
                      <button 
                        onClick={() => handleShareBook(f.id)}
                        disabled={sharing}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                      >
                        Gửi
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
