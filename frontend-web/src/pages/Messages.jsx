import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';
import { 
  Send, MessageSquare, Search, ChevronLeft, 
  Smile, Image, Paperclip, MoreVertical, Phone, Video, ExternalLink
} from 'lucide-react';

export default function Messages() {
  const { user } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();

  const [friendsList, setFriendsList] = useState([]);
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);

  const chatBottomRef = useRef(null);
  const friendsPollRef = useRef(null);
  const chatPollRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch friends list
  const fetchFriends = async (showLoading = true) => {
    if (showLoading) setLoadingFriends(true);
    try {
      const res = await api.get('/api/friends/list');
      if (res.data && res.data.friends) {
        setFriendsList(res.data.friends);
      }
    } catch (e) {
      console.error("Lỗi khi tải danh sách bạn bè:", e);
    } finally {
      if (showLoading) setLoadingFriends(false);
    }
  };

  // Fetch chat history with specific friend
  const fetchChatHistory = async (friendId, showLoading = true) => {
    try {
      const res = await api.get(`/api/messages/chat/${friendId}`);
      if (res.data && res.data.messages) {
        setChatMessages(res.data.messages);
      }
    } catch (e) {
      console.error("Lỗi khi tải lịch sử tin nhắn:", e);
    }
  };

  // Poll friends list and messages
  useEffect(() => {
    if (!user) return;
    fetchFriends(true);

    friendsPollRef.current = setInterval(() => {
      fetchFriends(false);
    }, 8000);

    return () => {
      if (friendsPollRef.current) clearInterval(friendsPollRef.current);
    };
  }, [user]);

  // Handle active chat polling
  useEffect(() => {
    if (activeChatFriend) {
      fetchChatHistory(activeChatFriend.id, true);
      // Mark read locally on active friend list
      setFriendsList(prev => prev.map(f => f.id === activeChatFriend.id ? { ...f, unread_messages: 0 } : f));

      chatPollRef.current = setInterval(() => {
        fetchChatHistory(activeChatFriend.id, false);
      }, 3000);
    } else {
      setChatMessages([]);
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    }

    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, [activeChatFriend]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!typedMessage.trim() || !activeChatFriend) return;

    const msgText = typedMessage.trim();
    setTypedMessage('');
    setSendingMessage(true);

    // Optimistic UI update
    const tempId = Date.now();
    const optimisticMsg = {
      id: tempId,
      sender_id: user.id,
      receiver_id: activeChatFriend.id,
      message: msgText,
      created_at: new Date().toISOString(),
      is_read: 0
    };
    setChatMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await api.post('/api/messages/send', {
        receiver_id: activeChatFriend.id,
        message: msgText
      });
      if (res.data && res.data.success) {
        // Update temporary message with real DB ID
        setChatMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: res.data.msg_id } : m));
      }
    } catch (err) {
      console.error("Gửi tin nhắn thất bại:", err);
      // Remove optimistic message on error
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      setTypedMessage(msgText); // Restore input
    } finally {
      setSendingMessage(false);
    }
  };

  // Filter friends based on search query
  const filteredFriends = friendsList.filter(f => 
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render message bubble with support for novel sharing format
  const renderMessageContent = (msgStr) => {
    if (msgStr.startsWith("[Chia sẻ truyện]") && msgStr.includes("/book/")) {
      const parts = msgStr.split(" - ");
      const titlePart = parts[0].replace("[Chia sẻ truyện] '", "").replace("'", "");
      
      const linkIndex = msgStr.indexOf("/book/");
      let bookId = "";
      if (linkIndex !== -1) {
        bookId = msgStr.substring(linkIndex + 6).split(/[\s"\n]/)[0];
      }

      const noteIndex = msgStr.indexOf("Lời nhắn: ");
      const note = noteIndex !== -1 ? msgStr.substring(noteIndex + 10) : "";

      return (
        <div className="p-3 bg-purple-900/30 border border-purple-500/20 rounded-xl space-y-2 max-w-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider block">Chia sẻ truyện</span>
              <span className="text-xs font-black text-white block mt-0.5">{titlePart}</span>
            </div>
            <button
              onClick={() => navigate(`/book/${bookId}`)}
              className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
            >
              <span>Đọc</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          {note && (
            <p className="text-[11px] text-slate-300 bg-black/20 p-2 rounded-lg border border-white/5 italic">
              "{note}"
            </p>
          )}
        </div>
      );
    }

    return <p className="text-xs whitespace-pre-wrap leading-relaxed select-text">{msgStr}</p>;
  };

  return (
    <MainLayout>
      <div className="max-w-[1400px] mx-auto px-4 py-6 md:py-10 h-[calc(100vh-80px)] flex flex-col">
        {/* Chat Main Shell */}
        <div className="flex-1 bg-[#121225]/80 border border-[#1f1f3a] rounded-3xl overflow-hidden flex shadow-2xl backdrop-blur-xl">
          
          {/* LEFT SIDEBAR: Friend list */}
          <div className={`w-full md:w-80 border-r border-[#1f1f3a] flex flex-col bg-[#0b0b14]/50 ${
            activeChatFriend ? 'hidden md:flex' : 'flex'
          }`}>
            
            {/* Sidebar Header */}
            <div className="p-4 border-b border-[#1f1f3a] space-y-3 shrink-0">
              <h3 className="text-sm font-black tracking-wider text-slate-100 uppercase flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                {lang === 'vi' ? 'Hộp thư đàm đạo' : 'Direct Messages'}
              </h3>
              
              {/* Quick Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input 
                  type="text" 
                  placeholder={lang === 'vi' ? 'Tìm bạn hữu...' : 'Search friends...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#05050a] border border-[#1f1f3a] rounded-xl text-xs text-white outline-none focus:border-purple-500 transition-colors placeholder-slate-600"
                />
              </div>
            </div>

            {/* Friends list stream */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 no-scrollbar">
              {loadingFriends && friendsList.length === 0 ? (
                <div className="flex justify-center items-center py-20 text-xs text-slate-500 gap-2">
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  Đang tải bạn hữu...
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-20 text-xs text-slate-600">
                  {searchQuery ? 'Không tìm thấy bạn hữu nào' : 'Chưa có bạn hữu nào'}
                </div>
              ) : (
                filteredFriends.map(f => {
                  const isActive = activeChatFriend?.id === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setActiveChatFriend(f)}
                      className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                        isActive 
                          ? 'bg-purple-600/20 border border-purple-500/30 text-white' 
                          : 'hover:bg-purple-950/10 border border-transparent hover:border-[#1f1f3a] text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {f.avatar ? (
                            <img src={f.avatar} className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/20" alt="avatar" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-brand-500 flex items-center justify-center font-black text-sm text-white shadow-inner">
                              {f.username[0].toUpperCase()}
                            </div>
                          )}
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0c0d1e]" />
                        </div>

                        {/* Name and preview */}
                        <div className="min-w-0">
                          <span className="font-extrabold text-xs block truncate">{f.username}</span>
                          <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                            {f.user_code ? `#${f.user_code}` : 'Đang trực tuyến'}
                          </span>
                        </div>
                      </div>

                      {/* Right unread badge */}
                      {f.unread_messages > 0 && (
                        <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-black min-w-[18px] text-center animate-pulse shadow-md">
                          {f.unread_messages}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT VIEW: Active chat window */}
          <div className={`flex-1 flex flex-col bg-[#080814]/30 ${
            !activeChatFriend ? 'hidden md:flex' : 'flex'
          }`}>
            
            {activeChatFriend ? (
              <>
                {/* Active Chat Header */}
                <div className="px-4 py-3 border-b border-[#1f1f3a] flex items-center justify-between bg-[#0b0b14]/50 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button 
                      onClick={() => setActiveChatFriend(null)}
                      className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors md:hidden shrink-0"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    {/* Friend Avatar */}
                    {activeChatFriend.avatar ? (
                      <img src={activeChatFriend.avatar} className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-purple-500/20" alt="avatar" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-brand-500 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-inner">
                        {activeChatFriend.username[0].toUpperCase()}
                      </div>
                    )}
                    
                    <div className="min-w-0">
                      <span className="font-extrabold text-xs text-slate-200 block truncate">{activeChatFriend.username}</span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">Đang đàm đạo</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all" title="Gọi thoại (Giả lập)">
                      <Phone className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all" title="Gọi video (Giả lập)">
                      <Video className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Messages stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar select-text bg-gradient-to-b from-[#080814]/10 to-[#0b0b14]/40">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-20 text-xs text-slate-600">
                      Hãy gửi lời chào đầu tiên tới {activeChatFriend.username}!
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => {
                      const isMe = msg.sender_id === user.id;
                      return (
                        <div 
                          key={msg.id || idx}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] sm:max-w-[60%] space-y-1`}>
                            {/* Bubble body */}
                            <div className={`p-3 rounded-2xl shadow-md ${
                              isMe 
                                ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-br-none' 
                                : 'bg-[#121225] border border-[#1f1f3a] text-slate-200 rounded-bl-none'
                            }`}>
                              {renderMessageContent(msg.message)}
                            </div>
                            {/* Timestamp */}
                            <span className={`text-[8px] text-slate-600 block ${isMe ? 'text-right' : 'text-left'}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Footer Chat Input form */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-[#1f1f3a] bg-[#0b0b14]/50 flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <button type="button" className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-slate-300 transition-colors" title="Đính kèm ảnh">
                      <Image className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-slate-300 transition-colors" title="Đính kèm tệp">
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </div>

                  <input 
                    type="text" 
                    placeholder="Nhập nội dung đàm đạo..."
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-[#05050a] border border-[#1f1f3a] rounded-2xl text-xs text-white outline-none focus:border-purple-500 transition-colors"
                  />

                  <button 
                    type="submit"
                    disabled={sendingMessage || !typedMessage.trim()}
                    className="p-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl transition-all disabled:opacity-40 shadow-lg shadow-purple-600/20 hover:scale-105 active:scale-95 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              /* Empty state placeholder */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
                <div className="w-20 h-20 bg-gradient-to-tr from-purple-600/20 to-brand-500/20 rounded-full flex items-center justify-center text-purple-400 shadow-xl mb-4 border border-purple-500/10 animate-pulse">
                  <MessageSquare className="w-9 h-9" />
                </div>
                <h3 className="font-extrabold text-base text-slate-200">Kính chào Thư hữu!</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
                  Hãy chọn một người bạn từ danh sách đàm đạo ở cột bên trái để bắt đầu nhắn tin và chia sẻ các tác phẩm truyện dịch AI tâm đắc.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
