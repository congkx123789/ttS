import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { 
  Users, MessageSquare, Bell, Send, Plus, Check, X, 
  ChevronLeft, UserPlus, Search, Share2, ExternalLink, Loader 
} from 'lucide-react';

export default function SocialDrawer({ isOpen, onClose, defaultTab }) {
  const { user } = useAuth();
  const { lang } = useLang();
  
  const [activeTab, setActiveTab] = useState(defaultTab || 'friends'); // 'friends', 'chat', 'notifications'
  const [friendsList, setFriendsList] = useState([]);
  const [personalNotifs, setPersonalNotifs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  
  // Chat state
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const chatBottomRef = useRef(null);
  const chatPollRef = useRef(null);
  const notifPollRef = useRef(null);

  useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
      if (defaultTab !== 'friends') {
        setActiveChatFriend(null);
      }
    }
  }, [isOpen, defaultTab]);

  // Poll notifications
  useEffect(() => {
    if (!user) return;
    fetchPersonalNotifs();
    fetchFriends();
    
    notifPollRef.current = setInterval(() => {
      fetchPersonalNotifs();
    }, 10000);

    return () => {
      clearInterval(notifPollRef.current);
    };
  }, [user]);

  // Handle active chat polling
  useEffect(() => {
    if (activeChatFriend) {
      fetchChatHistory(activeChatFriend.id);
      
      chatPollRef.current = setInterval(() => {
        fetchChatHistory(activeChatFriend.id, false);
      }, 3000);
    } else {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    }

    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, [activeChatFriend]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const fetchFriends = async () => {
    try {
      const res = await api.get('/api/friends/list');
      if (res.data && res.data.friends) {
        setFriendsList(res.data.friends);
      }
    } catch (e) {
      console.error("Failed to load friends", e);
    }
  };

  const fetchPersonalNotifs = async () => {
    try {
      const res = await api.get('/api/notifications/personal');
      if (res.data && res.data.notifications) {
        setPersonalNotifs(res.data.notifications);
      }
    } catch (e) {
      console.error("Failed to load personal notifications", e);
    }
  };

  const fetchChatHistory = async (friendId, showLoading = true) => {
    try {
      if (showLoading && chatMessages.length === 0) setSocialLoading(true);
      const res = await api.get(`/api/messages/chat/${friendId}`);
      if (res.data && res.data.messages) {
        setChatMessages(res.data.messages);
        // If there were unread messages, refresh friends list to clear badges
        fetchFriends();
      }
    } catch (e) {
      console.error("Failed to fetch chat history", e);
    } finally {
      setSocialLoading(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await api.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.data && res.data.users) {
        setSearchResults(res.data.users);
      }
    } catch (e) {
      console.error("User search failed", e);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendFriendRequest = async (targetQuery) => {
    try {
      const res = await api.post('/api/friends/request', { friend_username: targetQuery });
      if (res.data && res.data.success) {
        alert(lang === 'vi' ? `Đã gửi lời mời kết bạn tới ${res.data.to_user || targetQuery}!` : `Friend request sent!`);
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (e) {
      alert(e.response?.data?.error || "Gửi lời mời thất bại");
    }
  };

  const handleRespondRequest = async (senderId, action) => {
    try {
      const res = await api.post('/api/friends/respond', { sender_id: senderId, action });
      if (res.data && res.data.success) {
        fetchPersonalNotifs();
        fetchFriends();
      }
    } catch (e) {
      alert("Xử lý thất bại");
    }
  };

  const handleSendMessage = async () => {
    if (!typedMessage.trim() || !activeChatFriend) return;
    setSendingMessage(true);
    try {
      const res = await api.post('/api/messages/send', {
        receiver_id: activeChatFriend.id,
        message: typedMessage.trim()
      });
      if (res.data && res.data.success) {
        const newMsg = {
          id: res.data.msg_id,
          sender_id: user.id,
          receiver_id: activeChatFriend.id,
          message: typedMessage.trim(),
          created_at: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, newMsg]);
        setTypedMessage('');
      }
    } catch (e) {
      console.error("Failed to send message", e);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReadNotification = async (notifId) => {
    try {
      await api.post('/api/notifications/personal/read', { notification_id: notifId });
      fetchPersonalNotifs();
    } catch (e) {
      console.error("Failed to read notification", e);
    }
  };

  const unreadNotifsCount = personalNotifs.filter(n => !n.is_read).length;
  const totalUnreadMessages = friendsList.reduce((acc, cur) => acc + (cur.unread_messages || 0), 0);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 z-45 bg-black/60 backdrop-blur-sm"
      />

      {/* Drawer Container */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-96 bg-[#0c0d1e]/95 border-l border-purple-500/20 backdrop-blur-xl flex flex-col text-slate-100 shadow-2xl animate-slideOver">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-purple-500/10 flex items-center justify-between bg-[#0e1026]/90">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            <h3 className="font-extrabold text-sm tracking-wider uppercase bg-gradient-to-r from-brand-300 to-purple-400 bg-clip-text text-transparent">
              {lang === 'vi' ? 'Thư Hữu & Bạn bè' : 'Book Friends'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        {!activeChatFriend && (
          <div className="flex border-b border-purple-500/10 bg-[#0e1026]/50 p-1 text-[11px] font-bold gap-1 shrink-0">
            <button 
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 relative ${
                activeTab === 'friends' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Bạn bè' : 'Friends'}</span>
              {totalUnreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black px-0.5 shadow-md">
                  {totalUnreadMessages}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('search')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 relative ${
                activeTab === 'search' ? 'bg-teal-600/30 text-teal-300 border border-teal-500/30 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Tìm bạn' : 'Find'}</span>
            </button>

            <button 
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 relative ${
                activeTab === 'notifications' ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Thông báo' : 'Notif'}</span>
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-amber-500 text-white rounded-full flex items-center justify-center text-[8px] font-black px-0.5 shadow-md animate-pulse">
                  {unreadNotifsCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Active Chat view */}
          {activeChatFriend ? (
            <div className="h-full flex flex-col">
              {/* Back to list header */}
              <div className="flex items-center gap-2 border-b border-purple-500/10 pb-3 mb-3 shrink-0">
                <button 
                  onClick={() => setActiveChatFriend(null)}
                  className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 min-w-0">
                  {activeChatFriend.avatar ? (
                    <img src={activeChatFriend.avatar} className="w-7 h-7 rounded-full object-cover shrink-0" alt="avatar" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center font-black text-[10px] text-white shrink-0">
                      {activeChatFriend.username[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-xs text-slate-200">{activeChatFriend.username}</h4>
                    <p className="text-[9px] text-slate-500">Đang trò chuyện</p>
                  </div>
                </div>
              </div>

              {/* Chat messages stream */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4 select-text">
                {socialLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader className="w-6 h-6 animate-spin text-purple-500" />
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="text-center py-20 text-xs text-slate-600">
                    Chưa có tin nhắn nào. Hãy gửi lời chào!
                  </div>
                ) : (
                  chatMessages.map((msg, i) => {
                    const isSelf = msg.sender_id === user.id;
                    const isShare = msg.message.includes("[Chia sẻ truyện]");
                    return (
                      <div key={msg.id || i} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed border ${
                          isSelf 
                            ? 'bg-purple-600/20 border-purple-500/30 text-purple-200 rounded-tr-none' 
                            : 'bg-slate-900/50 border-slate-800 text-slate-300 rounded-tl-none'
                        }`}>
                          {isShare ? (
                            <div className="space-y-1">
                              <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider flex items-center gap-1">
                                <Share2 className="w-3 h-3" />
                                {lang === 'vi' ? 'Được chia sẻ' : 'Shared novel'}
                              </span>
                              <p className="font-medium text-slate-100">{msg.message.split(' - ')[0]}</p>
                              {msg.message.includes("Xem chi tiết tại") && (
                                <a 
                                  href={msg.message.split("Xem chi tiết tại ")[1]}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    window.location.href = msg.message.split("Xem chi tiết tại ")[1];
                                    onClose();
                                  }}
                                  className="inline-flex items-center gap-1 mt-1 text-[10px] text-brand-400 font-extrabold hover:underline"
                                >
                                  {lang === 'vi' ? 'Xem chi tiết' : 'View detail'}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            msg.message
                          )}
                          <span className="block text-[8px] text-slate-500 text-right mt-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Message inputs */}
              <div className="flex gap-2 border-t border-purple-500/10 pt-3 shrink-0">
                <input 
                  type="text" 
                  placeholder="Nhập tin nhắn..."
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 px-3 py-2 bg-[#080814] border border-purple-500/20 rounded-xl text-xs text-white outline-none focus:border-purple-500 transition-colors"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !typedMessage.trim()}
                  className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Friends Tab */}
              {activeTab === 'friends' && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                    {lang === 'vi' ? 'Danh sách bạn bè' : 'Friends list'} ({friendsList.length})
                  </h4>
                  {friendsList.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-purple-500/10 rounded-2xl text-xs text-slate-500 bg-purple-950/5">
                      {lang === 'vi' ? 'Chưa có bạn bè nào. Hãy sang tab "Tìm bạn" để kết nối!' : 'No friends yet. Go to "Find" tab to search!'}
                    </div>
                  ) : (
                    <div className="grid gap-2.5">
                      {friendsList.map(f => (
                        <div 
                          key={f.id} 
                          onClick={() => setActiveChatFriend(f)}
                          className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-950/10 to-indigo-950/10 hover:from-purple-900/25 hover:to-indigo-900/25 border border-purple-500/15 hover:border-purple-500/40 rounded-2xl cursor-pointer transition-all hover:scale-[1.01] shadow-md gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {f.avatar ? (
                              <img src={f.avatar} className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-purple-500/20" alt="avatar" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] flex items-center justify-center font-black text-xs text-white shrink-0 shadow-inner">
                                {f.username[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-200 block truncate">{f.username}</span>
                              {f.user_code && (
                                <span className="text-[9px] text-purple-400/70 font-mono block mt-0.5">#{f.user_code}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {f.unread_messages > 0 && (
                              <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-black min-w-[18px] text-center animate-pulse shadow-md">
                                {f.unread_messages}
                              </span>
                            )}
                            <div className="p-1.5 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg text-purple-400 transition-colors">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Search Friends Tab */}
              {activeTab === 'search' && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-teal-400">
                    {lang === 'vi' ? 'Tìm bạn hữu mới' : 'Find new friends'}
                  </h4>
                  
                  {/* Search for users */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500/70" />
                      <input 
                        type="text" 
                        placeholder={lang === 'vi' ? 'Tìm theo tên, email, mã ID 7 số...' : 'Search by name, email, 7-digit ID...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                        className="w-full pl-10 pr-8 py-2.5 bg-[#070b13] border border-teal-500/20 focus:border-teal-500 rounded-xl text-white outline-none transition-colors text-xs placeholder-slate-500"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] text-teal-500/60 px-1 leading-normal">
                      {lang === 'vi' ? 'ℹ️ Có thể tìm bằng tên đăng nhập, email hoặc mã ID 7 chữ số (ví dụ: 1234567)' : 'ℹ️ Search by username, email, or 7-digit ID (e.g. 1234567)'}
                    </p>
                  </div>

                  {/* Search Results list */}
                  {searchResults.length > 0 && (
                    <div className="bg-[#070b13]/90 border border-teal-500/20 rounded-xl p-2.5 space-y-1.5 shadow-lg">
                      <span className="text-[9px] font-black text-teal-400/80 uppercase px-2">
                        {lang === 'vi' ? 'Kết quả tìm kiếm' : 'Search results'} ({searchResults.length})
                      </span>
                      {searchResults.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-2 hover:bg-teal-950/20 rounded-xl gap-3 border border-transparent hover:border-teal-500/10 transition-all">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {u.avatar ? (
                              <img src={u.avatar} className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-teal-500/10" alt="avatar" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm">
                                {u.username ? u.username[0].toUpperCase() : 'U'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate">{u.username}</p>
                              {u.user_code && (
                                <p className="text-[9px] text-teal-500/70 font-mono mt-0.5"># {u.user_code}</p>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleSendFriendRequest(u.username)}
                            className="shrink-0 p-2 hover:bg-teal-600 bg-teal-600/10 text-teal-300 hover:text-white rounded-xl border border-teal-500/20 transition-all"
                            title={lang === 'vi' ? 'Kết bạn' : 'Add Friend'}
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchQuery && searchResults.length === 0 && !searchLoading && (
                    <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-teal-500/10 rounded-xl bg-teal-950/5">
                      Không tìm thấy kết quả phù hợp.
                    </div>
                  )}
                </div>
              )}

              {/* Personal Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400">Yêu cầu & Hoạt động</h4>
                  {personalNotifs.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-purple-500/10 rounded-2xl text-xs text-slate-500">
                      Không có thông báo mới.
                    </div>
                  ) : (
                    personalNotifs.map(notif => (
                      <div 
                        key={notif.id}
                        className={`p-3 border rounded-xl space-y-2 transition-all ${
                          notif.is_read 
                            ? 'bg-[#080814]/40 border-purple-500/5 text-slate-400' 
                            : 'bg-purple-950/10 border-purple-500/30 text-slate-200 shadow-lg shadow-purple-950/10'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-xs leading-relaxed">{notif.message}</p>
                          {!notif.is_read && (
                            <button 
                              onClick={() => handleReadNotification(notif.id)}
                              className="text-[9px] text-purple-400 hover:text-purple-300 underline shrink-0"
                            >
                              Đã đọc
                            </button>
                          )}
                        </div>

                        {notif.type === 'friend_request' && !notif.is_read && (
                          <div className="flex items-center gap-2 pt-1">
                            <button 
                              onClick={() => handleRespondRequest(notif.sender_id, 'accept')}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition-colors"
                            >
                              <Check className="w-3 h-3" /> Đồng ý
                            </button>
                            <button 
                              onClick={() => handleRespondRequest(notif.sender_id, 'reject')}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-[#121225] border border-[#1f1f3a] text-slate-300 hover:bg-slate-800 rounded-lg text-[10px] font-bold transition-colors"
                            >
                              <X className="w-3 h-3" /> Từ chối
                            </button>
                          </div>
                        )}

                        {notif.type === 'book_share' && (
                          <a 
                            href={`/book/${notif.related_id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              window.location.href = `/book/${notif.related_id}`;
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-brand-400 font-extrabold hover:underline pt-1"
                          >
                            Đọc truyện ngay
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}

                        <span className="block text-[8px] text-slate-500 italic">
                          {new Date(notif.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
