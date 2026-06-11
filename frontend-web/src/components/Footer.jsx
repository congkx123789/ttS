import React, { useState } from 'react';
import { Mail, MessageSquare, Send, BookOpen, Heart, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorText, setErrorText] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      setErrorText('Vui lòng điền đầy đủ email và nội dung phản hồi.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorText('');

    try {
      const res = await api.post('/api/feedback/submit', {
        email: email.trim(),
        message: message.trim()
      });

      if (res.data && res.data.success) {
        setStatus('success');
        setEmail('');
        setMessage('');
        setTimeout(() => setStatus('idle'), 4000);
      } else {
        setErrorText(res.data.error || 'Có lỗi xảy ra khi gửi phản hồi.');
        setStatus('error');
      }
    } catch (err) {
      console.error(err);
      setErrorText(err.response?.data?.error || 'Không thể kết nối tới máy chủ. Vui lòng thử lại sau.');
      setStatus('error');
    }
  };

  return (
    <footer className="mt-16 bg-[#0a0a16] border-t border-[#1f1f3a]/80 text-slate-400 py-10 px-4 sm:px-8 lg:px-16 relative overflow-hidden">
      {/* Background glowing orb */}
      <div className="absolute bottom-[-100px] left-[10%] w-[350px] h-[350px] rounded-full bg-purple-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[-50px] right-[10%] w-[300px] h-[300px] rounded-full bg-cyan-600/5 blur-[100px] pointer-events-none" />

      <div className="max-w-[2200px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 relative z-10">
        
        {/* Info Column (Left 3 cols) */}
        <div className="md:col-span-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/10">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-white font-extrabold tracking-wide text-xs bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-200">
              TRUYỆN DỊCH AI
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Hệ thống tối ưu hóa dịch thuật tiếng Trung bằng AI, tích hợp đọc truyện trực tuyến và đồng bộ hóa Chrome Extension.
          </p>
          <div className="space-y-1.5 pt-1 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-purple-400" />
              <span>Liên hệ: <a href="mailto:havucong@lyvuha.com" className="text-purple-400 hover:underline">havucong@lyvuha.com</a></span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Hỗ trợ kỹ thuật trực tuyến</span>
            </div>
          </div>
        </div>

        {/* Links Column (Middle 3 cols, spread horizontally in 2 columns) */}
        <div className="md:col-span-3 space-y-3">
          <h4 className="text-white font-bold text-xs tracking-wider uppercase">Menu nhanh</h4>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
            <li>
              <a href="/" className="hover:text-purple-400 transition-colors">Khám phá</a>
            </li>
            <li>
              <a href="/bookshelf" className="hover:text-purple-400 transition-colors">Tủ sách</a>
            </li>
            <li>
              <a href="/history" className="hover:text-purple-400 transition-colors">Lịch sử</a>
            </li>
            <li>
              <a href="/developer" className="hover:text-purple-400 transition-colors">API Dịch</a>
            </li>
            <li>
              <a href="/settings" className="hover:text-purple-400 transition-colors">Cài đặt</a>
            </li>
          </ul>
        </div>

        {/* Feedback Form Column (Right 6 cols, spread horizontally) */}
        <div className="md:col-span-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h4 className="text-white font-bold text-xs tracking-wider uppercase flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-purple-400" /> Gửi phản hồi & Báo lỗi
            </h4>
            <span className="text-[10px] text-slate-500 hidden sm:inline">Ý kiến của bạn giúp cải thiện chất lượng dịch AI</span>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col">
              <textarea
                placeholder="Nội dung phản hồi (báo lỗi dịch thuật, âm thanh TTS, yêu cầu truyện...)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full h-full min-h-[90px] bg-[#111126] border border-[#1f1f3a] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none"
                disabled={status === 'loading'}
                required
              />
            </div>
            
            <div className="flex flex-col justify-between gap-2.5">
              <input
                type="email"
                placeholder="Email của bạn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111126] border border-[#1f1f3a] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                disabled={status === 'loading'}
                required
              />
              
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all duration-300 shadow-lg shadow-purple-900/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" /> Gửi phản hồi
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Success or Error notifications inside columns */}
          {status === 'success' && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] bg-emerald-500/5 border border-emerald-500/20 p-2 rounded-lg animate-fadeIn">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Gửi phản hồi thành công! Cảm ơn sự đóng góp của bạn.</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-1.5 text-rose-400 text-[11px] bg-rose-500/5 border border-rose-500/20 p-2 rounded-lg animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorText}</span>
            </div>
          )}
        </div>

      </div>

      {/* Copyright Footer Row */}
      <div className="max-w-[2200px] mx-auto mt-8 pt-5 border-t border-[#1f1f3a]/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500">
        <div className="flex items-center gap-1">
          <span>&copy; {new Date().getFullYear()} TruyenDichAI. Toàn bộ bản quyền được bảo lưu.</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Được xây dựng với</span>
          <Heart className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse" />
          <span>bởi đội ngũ phát triển</span>
        </div>
      </div>
    </footer>
  );
}
