import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useLang } from '../contexts/LangContext';
import { Volume2, Server, Gift, RefreshCw, MessageSquare, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function SystemTicker() {
  const { lang } = useLang();
  const [notifications, setNotifications] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    return () => clearInterval(intervalRef.current);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/system/notifications');
      if (res.data && res.data.length > 0) {
        setNotifications(res.data);
        startRotation(res.data.length);
      }
    } catch (e) {
      console.error("Failed to load system notifications", e);
    } finally {
      setLoading(false);
    }
  };

  const startRotation = (length) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % length);
    }, 6000);
  };

  const handleNext = () => {
    if (notifications.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % notifications.length);
    startRotation(notifications.length);
  };

  const handlePrev = () => {
    if (notifications.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + notifications.length) % notifications.length);
    startRotation(notifications.length);
  };

  if (!visible || loading || notifications.length === 0) return null;

  const current = notifications[currentIndex];

  const getBadgeStyles = (type) => {
    switch (type) {
      case 'server':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: Server,
          label: lang === 'vi' ? 'Hệ thống' : lang === 'en' ? 'System' : '系统'
        };
      case 'promo':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          icon: Gift,
          label: lang === 'vi' ? 'Sự kiện' : lang === 'en' ? 'Event' : '活动'
        };
      case 'update':
        return {
          bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
          icon: RefreshCw,
          label: lang === 'vi' ? 'Cập nhật' : lang === 'en' ? 'Update' : '更新'
        };
      case 'comment':
        return {
          bg: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
          icon: MessageSquare,
          label: lang === 'vi' ? 'Bình luận' : lang === 'en' ? 'Comment' : '评论'
        };
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
          icon: Volume2,
          label: lang === 'vi' ? 'Thông báo' : lang === 'en' ? 'Notice' : '公告'
        };
    }
  };

  const badge = getBadgeStyles(current.type);
  const BadgeIcon = badge.icon;

  return (
    <div 
      className="bg-[#0f0f26]/80 border-b border-[#1f1f3a] backdrop-blur-md text-slate-300 relative z-30 transition-all duration-300 animate-fadeIn"
      onMouseEnter={() => clearInterval(intervalRef.current)}
      onMouseLeave={() => startRotation(notifications.length)}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-2 flex items-center justify-between gap-4">
        
        {/* Left Side: Badge + Sliding Message */}
        <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
          {/* Animated notification speaker icon */}
          <div className="relative flex items-center justify-center shrink-0">
            <span className="absolute inline-flex h-4 w-4 rounded-full bg-purple-500/20 animate-ping" />
            <Volume2 className="w-4 h-4 text-purple-400 relative z-10" />
          </div>

          {/* Type Badge */}
          <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 border rounded-full text-[10px] font-black tracking-wider uppercase shrink-0 ${badge.bg}`}>
            <BadgeIcon className="w-3 h-3" />
            {badge.label}
          </span>

          {/* Message sliding container */}
          <div className="text-xs font-semibold truncate select-none text-slate-100 flex-1 pr-4 animate-slideIn">
            <span className="text-purple-400 font-extrabold mr-1.5 sm:hidden">[{badge.label}]</span>
            {current.message}
            <span className="text-[10px] text-slate-500 ml-2 italic shrink-0">({current.time})</span>
          </div>
        </div>

        {/* Right Side: Navigation buttons + Close */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center border border-white/5 bg-[#0b0b14]/40 rounded-lg p-0.5">
            <button 
              onClick={handlePrev}
              className="p-1 hover:bg-white/5 text-slate-500 hover:text-white rounded transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold text-slate-600 px-1.5 select-none">
              {currentIndex + 1}/{notifications.length}
            </span>
            <button 
              onClick={handleNext}
              className="p-1 hover:bg-white/5 text-slate-500 hover:text-white rounded transition-colors"
              title="Next"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button 
            onClick={() => setVisible(false)}
            className="p-1 hover:bg-white/5 text-slate-500 hover:text-white rounded-lg transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
