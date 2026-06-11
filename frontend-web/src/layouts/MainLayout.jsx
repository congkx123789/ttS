import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut, Crown, Compass, BookMarked, History,
  Terminal, BookOpen, Settings as SettingsIcon, Menu, X, ChevronDown, MessageSquare, Bell
} from 'lucide-react';
import AuthModal from '../components/AuthModal';
import VipModal from '../components/VipModal';
import SystemTicker from '../components/SystemTicker';
import Footer from '../components/Footer';
import SocialDrawer from '../components/SocialDrawer';
import api from '../services/api';

export default function MainLayout({ children, hideHeader = false, stats = { total: 931427, duplicates: 0 } }) {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  const [authOpen, setAuthOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialTab, setSocialTab] = useState('friends');
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadMsgCount(0);
      setUnreadNotifCount(0);
      return;
    }
    const fetchUnread = async () => {
      try {
        const res = await api.get('/api/notifications/unread-counts');
        if (res.data) {
          setUnreadMsgCount(res.data.messages || 0);
          setUnreadNotifCount(res.data.notifications || 0);
        }
      } catch (e) {
        // fallback: try old endpoint
        try {
          const res2 = await api.get('/api/notifications/personal');
          if (res2.data && res2.data.notifications) {
            const unread = res2.data.notifications.filter(n => !n.is_read).length;
            setUnreadNotifCount(unread);
          }
        } catch {}
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const getActiveTab = () => {
    if (location.pathname === '/')          return 'all';
    if (location.pathname === '/bookshelf') return 'bookshelf';
    if (location.pathname === '/history')   return 'history';
    if (location.pathname === '/developer') return 'developer';
    if (location.pathname === '/embed')     return 'embed';
    if (location.pathname === '/settings')  return 'settings';
    if (location.pathname === '/sects')     return 'sects';
    return 'all';
  };

  const handleTabChange = (tab) => {
    setMobileMenuOpen(false);
    if (tab === 'all')       navigate('/');
    if (tab === 'bookshelf') navigate('/bookshelf');
    if (tab === 'history')   navigate('/history');
    if (tab === 'developer') navigate('/developer');
    if (tab === 'embed')     navigate('/embed');
    if (tab === 'settings')  navigate('/settings');
    if (tab === 'sects')     navigate('/sects');
  };

  const activeTab = getActiveTab();

  // Bottom nav items (mobile only — 5 main tabs)
  const bottomNavItems = [
    { key: 'all',       icon: Compass,      label: t.tabDiscover   },
    { key: 'bookshelf', icon: BookMarked,    label: t.tabBookshelf  },
    { key: 'history',   icon: History,       label: t.tabHistory    },
    { key: 'embed',     icon: BookOpen,      label: t.tabEmbed      },
    { key: 'settings',  icon: SettingsIcon,  label: t.tabSettings   },
  ];

  // Desktop tab items (full set)
  const desktopNavItems = [
    { key: 'all',       icon: Compass,     label: t.tabDiscover  },
    { key: 'bookshelf', icon: BookMarked,  label: t.tabBookshelf },
    { key: 'history',   icon: History,     label: t.tabHistory   },
    { key: 'developer', icon: Terminal,    label: t.tabDeveloper },
    { key: 'embed',     icon: BookOpen,    label: t.tabEmbed     },
    ...(user ? [
      { key: 'sects', icon: Crown, label: lang === 'vi' ? 'Tông Môn' : 'Sects' },
      { key: 'settings', icon: SettingsIcon, label: t.tabSettings }
    ] : []),
  ];

  return (
    <div className={`min-h-screen min-h-[100dvh] flex flex-col bg-[#0b0b14] text-slate-100`}>

      {/* ─── HEADER ─── */}
      {!hideHeader && (
        <header className="bg-[#1c183a] border-b border-indigo-950/30 shadow-lg sticky top-0 z-40">
          <div className="max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-12 h-14 flex items-center justify-between gap-3">

            {/* LEFT: Logo */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 shrink-0"
            >
              <span className="text-sm font-extrabold text-white leading-tight">
                {t.title}
              </span>
            </button>

            {/* CENTER: Desktop tabs */}
            <nav className="hidden lg:flex bg-[#0f0f26]/60 rounded-full p-1 border border-white/5 text-[11px] font-bold gap-0.5">
              {desktopNavItems.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all relative ${
                    activeTab === key
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {key === 'settings' && user?.require_password_change === 1 && (
                    <span className="absolute top-1 right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* RIGHT: Language + Auth */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Language switcher */}
              <div className="flex bg-[#0f0f26]/60 rounded-full p-0.5 border border-white/5 text-[9px] font-bold">
                {[['vi','🇻🇳'],['en','🇺🇸'],['zh','🇨🇳']].map(([l, flag]) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-2 py-1 rounded-full transition-all ${lang === l ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {flag} <span className="hidden sm:inline">{l.toUpperCase()}</span>
                  </button>
                ))}
              </div>

              {/* Auth */}
              {user ? (
                <div className="hidden sm:flex items-center gap-2">
                  {/* Tin nhắn riêng */}
                  <button
                    onClick={() => navigate('/messages')}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors relative"
                    title="Tin nhắn riêng"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {unreadMsgCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[9px] font-black px-0.5 shadow-md">
                        {unreadMsgCount > 99 ? '99+' : unreadMsgCount}
                      </span>
                    )}
                  </button>

                  {/* Thông báo thư hữu */}
                  <button
                    onClick={() => { setSocialTab('notifications'); setSocialOpen(true); }}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors relative"
                    title="Thông báo thư hữu"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadNotifCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-amber-500 text-white rounded-full flex items-center justify-center text-[9px] font-black px-0.5 shadow-md animate-pulse">
                        {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => navigate('/settings')}
                    className="text-slate-200 text-xs font-bold hover:text-purple-400 transition-colors flex items-center gap-1.5 max-w-[140px] truncate bg-[#0f0f26]/40 px-2.5 py-1 rounded-full border border-white/5 hover:border-purple-500/30 transition-all"
                  >
                    {user.avatar ? (
                      <img src={user.avatar} className="w-4 h-4 rounded-full object-cover shrink-0" alt="avatar" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-purple-600/50 flex items-center justify-center text-[9px] font-black shrink-0 text-white">
                        {user.username ? user.username[0].toUpperCase() : 'U'}
                      </span>
                    )}
                    <span>{user.display_name || user.username}</span>
                    {user.require_password_change === 1 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    )}
                  </button>
                  <button
                    onClick={logout}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md transition-all"
                >
                  {t.login}
                </button>
              )}

              {/* Mobile: hamburger (for developer tab not in bottom nav + user menu) */}
              <button
                onClick={() => setMobileMenuOpen(v => !v)}
                className="lg:hidden p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile dropdown menu (for extra items + user info) */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-white/5 bg-[#1c183a] animate-fadeIn">
              <div className="px-4 py-3 space-y-1">
                {/* Developer tab (not in bottom nav) */}
                <button
                  onClick={() => handleTabChange('developer')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'developer'
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  {t.tabDeveloper}
                </button>

                {/* User info on mobile */}
                {user && (
                  <>
                    <div className="h-px bg-white/5 my-2" />
                    {/* Thư hữu button on mobile */}
                    <button
                      onClick={() => { setSocialOpen(true); setMobileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5 transition-all relative"
                    >
                      <MessageSquare className="w-4 h-4 text-purple-400" />
                      {lang === 'vi' ? 'Thư Hữu & Bạn bè' : lang === 'en' ? 'Book Friends' : '书友'}
                      {(unreadMsgCount + unreadNotifCount) > 0 && (
                        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black px-1">
                          {unreadMsgCount + unreadNotifCount > 99 ? '99+' : unreadMsgCount + unreadNotifCount}
                        </span>
                      )}
                    </button>
                    <div className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-xs font-bold text-white">{user.username}</p>
                        <p className="text-[10px] text-slate-500">{user.email}</p>
                      </div>
                      <button
                        onClick={() => { logout(); setMobileMenuOpen(false); }}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-semibold"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        {lang === 'vi' ? 'Đăng xuất' : lang === 'en' ? 'Logout' : '退出'}
                      </button>
                    </div>
                  </>
                )}

                {/* Stats on mobile */}
                <div className="flex items-center gap-4 px-3 py-2 text-[10px] text-slate-500">
                  <span>{(stats.total || 931427).toLocaleString()} {lang === 'vi' ? 'truyện' : lang === 'en' ? 'novels' : '本'}</span>
                  <span>•</span>
                  <span>7 {lang === 'vi' ? 'nguồn' : lang === 'en' ? 'sources' : '源'}</span>
                </div>
              </div>
            </div>
          )}
        </header>
      )}

      {!hideHeader && <SystemTicker />}

      {/* ─── MAIN CONTENT ─── */}
      <main className={
        hideHeader
          ? 'w-full flex-1'
          : 'max-w-[2200px] mx-auto px-3 sm:px-6 lg:px-12 py-4 sm:py-6 flex-1 w-full pb-24 lg:pb-6'
      }>
        {children}
      </main>

      {/* ─── FOOTER ─── */}
      {!hideHeader && <Footer />}

      {/* ─── MOBILE BOTTOM NAVIGATION ─── */}
      {!hideHeader && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1c183a]/95 backdrop-blur-md border-t border-white/8 safe-bottom">
          <div className="flex items-stretch h-16">
            {bottomNavItems.map(({ key, icon: Icon, label }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-all active:scale-95"
                >
                  {/* Active indicator dot */}
                  {isActive && (
                    <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-500 nav-active" />
                  )}
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-purple-400' : 'text-slate-500'
                    }`}
                  />
                  <span
                    className={`text-[9px] font-bold transition-colors ${
                      isActive ? 'text-purple-400' : 'text-slate-600'
                    }`}
                  >
                    {label}
                  </span>
                  {/* Badge for settings password warning */}
                  {key === 'settings' && user?.require_password_change === 1 && (
                    <span className="absolute top-2.5 right-[calc(50%-10px)] flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      <VipModal  isOpen={vipOpen}  onClose={() => setVipOpen(false)}  />
      <SocialDrawer isOpen={socialOpen} onClose={() => setSocialOpen(false)} defaultTab={socialTab} />
    </div>
  );
}
