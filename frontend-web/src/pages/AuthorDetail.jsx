import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { useLang } from '../contexts/LangContext';
import api from '../services/api';
import { 
  User, Book, ChevronRight, Loader, ExternalLink, 
  Layers, FileText, Globe, Award 
} from 'lucide-react';

export default function AuthorDetail() {
  const { authorName } = useParams();
  const { lang } = useLang();
  const navigate = useNavigate();

  const [authorInfo, setAuthorInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAuthorDetails();
  }, [authorName]);

  const fetchAuthorDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/author/${encodeURIComponent(authorName)}`);
      setAuthorInfo(res.data);
    } catch (e) {
      console.error(e);
      setError(
        lang === 'vi' 
          ? 'Không tìm thấy thông tin tác giả hoặc có lỗi xảy ra.' 
          : lang === 'en' 
            ? 'Failed to load author details.' 
            : '无法加载作者详情。'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="py-20 text-center text-slate-500">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-purple-500" />
          <span>
            {lang === 'vi' 
              ? 'Đang tải thông tin tác giả...' 
              : lang === 'en' 
                ? 'Loading author details...' 
                : '正在加载作者信息...'}
          </span>
        </div>
      </MainLayout>
    );
  }

  if (error || !authorInfo) {
    return (
      <MainLayout>
        <div className="py-20 text-center text-red-500 font-bold">
          {error || 'Lỗi không xác định.'}
        </div>
      </MainLayout>
    );
  }

  const { author_chinese, author_hanviet, total_books, books } = authorInfo;

  // Calculate total chapters
  const totalChapters = books.reduce((acc, b) => acc + (b.chapters_max || 0), 0);

  return (
    <MainLayout>
      {/* Author Banner Header */}
      <div className="relative rounded-3xl overflow-hidden border border-[#1f1f3a] mb-8 bg-[#0b0b14]/70 p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center md:items-start z-0">
        <div className="absolute inset-0 z-[-1] opacity-10 blur-3xl bg-gradient-to-r from-purple-500 to-indigo-600 scale-110" />

        <div className="w-16 h-16 md:w-20 md:h-20 bg-purple-500/10 border-2 border-purple-500/30 rounded-2xl flex items-center justify-center text-purple-400 shrink-0 shadow-lg shadow-purple-500/5">
          <User className="w-8 h-8 md:w-10 md:h-10" />
        </div>

        <div className="flex-1 min-w-0 text-center md:text-left space-y-2">
          <span className="px-2.5 py-0.5 bg-purple-500/10 border border-purple-500/25 text-purple-400 rounded-full text-[10px] font-black uppercase tracking-wider">
            {lang === 'vi' ? 'Hồ sơ tác giả' : lang === 'en' ? 'Author Profile' : '作者档案'}
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
            {author_hanviet}
          </h2>
          <p className="text-slate-400 text-xs font-semibold">
            {lang === 'vi' ? 'Tên gốc Trung' : lang === 'en' ? 'Chinese Original Name' : '中文原名'}:{' '}
            <span className="text-purple-300 font-bold bg-[#121225] px-2 py-0.5 rounded border border-[#1f1f3a]">
              {author_chinese}
            </span>
          </p>

          {/* Quick Stats Grid */}
          <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-3 text-xs text-slate-400">
            <div className="bg-[#121225]/80 border border-[#1f1f3a]/80 px-4 py-2 rounded-xl flex items-center gap-2">
              <Book className="w-4 h-4 text-purple-400" />
              <span>
                <strong>{total_books}</strong> {lang === 'vi' ? 'Truyện' : lang === 'en' ? 'Books' : '本小说'}
              </span>
            </div>
            <div className="bg-[#121225]/80 border border-[#1f1f3a]/80 px-4 py-2 rounded-xl flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>
                <strong>{totalChapters.toLocaleString()}</strong> {lang === 'vi' ? 'Chương tích lũy' : lang === 'en' ? 'Total Chapters' : '总章节'}
              </span>
            </div>
            <div className="bg-[#121225]/80 border border-[#1f1f3a]/80 px-4 py-2 rounded-xl flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-400" />
              <span>
                <strong>Antigravity Verified</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Novels Header */}
      <div className="mb-6 flex justify-between items-center">
        <h3 className="text-lg font-black text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          {lang === 'vi' ? 'Các tác phẩm tiêu biểu' : lang === 'en' ? 'Works List' : '代表作品'}
        </h3>
        <span className="text-xs text-slate-500 font-bold">
          {lang === 'vi' ? `Hiển thị ${books.length} kết quả` : lang === 'en' ? `${books.length} results` : `共 ${books.length} 部`}
        </span>
      </div>

      {/* Novels Cards List */}
      <div className="space-y-6">
        {books.map((novel) => (
          <div 
            key={novel.id} 
            className="bg-[#121225]/50 border border-[#1f1f3a] rounded-3xl p-5 md:p-6 flex flex-col md:flex-row gap-5 hover:border-purple-500/20 hover:bg-[#121225]/70 transition-all duration-300 relative group"
          >
            {/* Book Cover */}
            {novel.cover ? (
              <img 
                src={novel.cover} 
                alt="cover" 
                className="w-[90px] h-[125px] md:w-[110px] md:h-[155px] object-cover rounded-xl border border-[#1f1f3a] shadow-lg group-hover:scale-[1.02] transition-transform duration-300 shrink-0 mx-auto md:mx-0" 
              />
            ) : (
              <div className="w-[90px] h-[125px] md:w-[110px] md:h-[155px] bg-[#0b0b14] border border-[#1f1f3a] rounded-xl flex items-center justify-center text-slate-600 shrink-0 mx-auto md:mx-0">
                <Book className="w-10 h-10" />
              </div>
            )}

            {/* Book Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3 text-center md:text-left">
              <div className="space-y-1.5">
                <h4 
                  onClick={() => navigate(`/book/${novel.id}`)}
                  className="text-base md:text-lg font-black text-white cursor-pointer hover:text-purple-400 transition-colors leading-tight inline-block"
                >
                  {novel.title_vietphrase || novel.title_hanviet}
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold">
                  {lang === 'vi' ? 'Tiêu đề gốc' : lang === 'en' ? 'Original Title' : '原著'}: {novel.title} · {novel.chapters_max} {lang === 'vi' ? 'chương' : lang === 'en' ? 'chapters' : '章'}
                </p>
                <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">
                  {novel.description_vietphrase || novel.description_hanviet || novel.description || (lang === 'vi' ? 'Chưa có tóm tắt nội dung.' : lang === 'en' ? 'No description available.' : '暂无内容简介。')}
                </p>
              </div>

              {/* Badges + Sources */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[#1f1f3a]/40">
                {/* Categories badges */}
                <div className="flex flex-wrap justify-center md:justify-start gap-1.5">
                  {novel.categories && novel.categories.split(/[,，]/).map(c => c.trim()).filter(Boolean).map((cat, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-[#0b0b14]/60 border border-[#1f1f3a] text-slate-400 rounded-md text-[10px] font-semibold">
                      {cat}
                    </span>
                  ))}
                </div>

                {/* Original Web Source Links (các trang web gốc) */}
                <div className="flex flex-wrap justify-center sm:justify-end items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                    <Globe className="w-3 h-3 text-purple-400" />
                    {lang === 'vi' ? 'Nguồn gốc:' : lang === 'en' ? 'Source web:' : '来源网站:'}
                  </span>
                  
                  {novel.parsed_sources && novel.parsed_sources.length > 0 ? (
                    novel.parsed_sources.map((src, idx) => (
                      <a 
                        key={idx}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-purple-950/20 hover:bg-purple-900/40 border border-purple-500/20 hover:border-purple-500/30 text-purple-300 rounded-lg text-[9px] font-black transition-colors"
                        title={src.url}
                      >
                        {src.source}
                        <ExternalLink className="w-2.5 h-2.5 text-purple-400" />
                      </a>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-600 italic">
                      {lang === 'vi' ? 'Không rõ' : lang === 'en' ? 'Unknown' : '未知'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </MainLayout>
  );
}
