import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';
import { 
  Crown, Users, MessageSquare, Send, Award, Plus, 
  Trash2, LogOut, ArrowRight, Shield, ShieldAlert, Sparkles, Coins,
  BookOpen, Check, X, ShieldCheck, Edit, BookMarked, ExternalLink,
  Search, MessageCircle, Settings, UserPlus, UserMinus, ChevronRight
} from 'lucide-react';

const ROLE_ORDER = {
  "leader": 1,
  "vice_leader": 2,
  "elder": 3,
  "inner_disciple": 4,
  "member": 5,
};

const ROLE_LABELS = {
  "leader": "Tông chủ",
  "vice_leader": "Phó Tông chủ",
  "elder": "Trưởng lão",
  "inner_disciple": "Nội môn đệ tử",
  "member": "Ngoại môn đệ tử",
};

export default function Sects() {
  const { user } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();

  // General state
  const [inSect, setInSect] = useState(false);
  const [mySectData, setMySectData] = useState(null);
  const [sectsList, setSectsList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('info'); // 'info', 'disciples', 'requests', 'library', 'chat', 'contribute'

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSectDetail, setSelectedSectDetail] = useState(null);
  const [showSectDetailModal, setShowSectDetailModal] = useState(false);

  // Forms
  const [createName, setCreateName] = useState('');
  const [createSlogan, setCreateSlogan] = useState('');
  const [createBadge, setCreateBadge] = useState('purple');
  const [contribAmount, setContribAmount] = useState(50);
  const [editAnnouncement, setEditAnnouncement] = useState('');
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);

  // Chat channels state
  const [chatType, setChatType] = useState('general'); // 'general', 'group', 'direct'
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedDirectUser, setSelectedDirectUser] = useState(null); // { id, username, avatar }
  
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const [subGroups, setSubGroups] = useState([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]); // Array of user IDs

  // Group settings
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [activeGroupDetail, setActiveGroupDetail] = useState(null); // Detailed group data with members

  // Library & Books
  const [joinRequestsList, setJoinRequestsList] = useState([]);
  const [sectBooksList, setSectBooksList] = useState([]);
  const [userBookshelf, setUserBookshelf] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);

  // Loading & Alerts
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const chatBottomRef = useRef(null);
  const pollRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Load Sect status, list, or search
  const loadSectInfo = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/sects/my-sect');
      if (res.data && res.data.in_sect) {
        setInSect(true);
        setMySectData(res.data);
        setEditAnnouncement(res.data.sect.announcement || '');
        
        // Load sub-tab specific data
        if (activeSubTab === 'requests' && ['leader', 'vice_leader', 'elder'].includes(res.data.role)) {
          fetchJoinRequests();
        }
        if (activeSubTab === 'library') {
          fetchSectLibrary();
        }
        if (activeSubTab === 'chat') {
          fetchSubGroups();
        }
      } else {
        setInSect(false);
        setMySectData(null);
        handleSearch();
      }
    } catch (e) {
      console.error("Lỗi khi tải thông tin Tông môn:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      const res = await api.get(`/api/sects/search`, { params: { q: searchQuery } });
      if (res.data && res.data.sects) {
        setSectsList(res.data.sects);
      }
      // Load pending requests
      const listRes = await api.get('/api/sects/list');
      if (listRes.data) {
        setPendingRequests(listRes.data.pending_requests || []);
      }
    } catch (err) {
      console.error("Lỗi tìm kiếm tông môn:", err);
    }
  };

  const viewSectDetail = async (sectId) => {
    setActionLoading(true);
    try {
      const res = await api.get(`/api/sects/${sectId}`);
      if (res.data) {
        setSelectedSectDetail(res.data);
        setShowSectDetailModal(true);
      }
    } catch (err) {
      showError("Không thể tải thông tin tông môn chi tiết");
    } finally {
      setActionLoading(false);
    }
  };

  const fetchJoinRequests = async () => {
    try {
      const res = await api.get('/api/sects/requests/list');
      if (res.data && res.data.requests) {
        setJoinRequestsList(res.data.requests);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSectLibrary = async () => {
    try {
      const res = await api.get('/api/sects/library/list');
      if (res.data && res.data.books) {
        setSectBooksList(res.data.books);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUserBookshelf = async () => {
    try {
      const res = await api.get('/api/bookshelf');
      if (res.data) {
        setUserBookshelf(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSubGroups = async () => {
    try {
      const res = await api.get('/api/sects/chat/groups');
      if (res.data && res.data.groups) {
        setSubGroups(res.data.groups);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch chat history
  const fetchChatHistory = async () => {
    try {
      let params = { chat_type: chatType };
      if (chatType === 'group' && selectedGroupId) {
        params.group_id = selectedGroupId;
      } else if (chatType === 'direct' && selectedDirectUser) {
        params.target_id = selectedDirectUser.user_id || selectedDirectUser.id;
      } else if (chatType !== 'general') {
        return; // Undefined state
      }

      const res = await api.get('/api/sects/chat/history', { params });
      if (res.data && res.data.messages) {
        setChatMessages(res.data.messages);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSectInfo();
  }, [activeSubTab]);

  // Set up polling for chat channels
  useEffect(() => {
    if (inSect && activeSubTab === 'chat') {
      fetchChatHistory();
      pollRef.current = setInterval(fetchChatHistory, 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [inSect, activeSubTab, chatType, selectedGroupId, selectedDirectUser]);

  // Auto-scroll chat
  useEffect(() => {
    if (activeSubTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeSubTab]);

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
  };
  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const handleCreateSect = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/create', {
        name: createName.trim(),
        slogan: createSlogan.trim(),
        badge: createBadge
      });
      if (res.data && res.data.success) {
        showSuccess(res.data.message);
        setCreateName('');
        setCreateSlogan('');
        setActiveSubTab('info');
        await loadSectInfo();
      }
    } catch (err) {
      showError(err.response?.data?.error || "Không thể thành lập Tông môn");
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinSect = async (sectId) => {
    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/join', { sect_id: sectId });
      if (res.data && res.data.success) {
        showSuccess(res.data.message);
        setPendingRequests(prev => [...prev, sectId]);
        setShowSectDetailModal(false);
      }
    } catch (err) {
      showError(err.response?.data?.error || "Gia nhập tông môn thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveSect = async () => {
    const confirmMsg = mySectData?.role === 'leader' 
      ? "Bạn là Tông chủ, rời đi sẽ giải tán Tông môn và xóa toàn bộ dữ liệu. Bạn chắc chắn chứ?" 
      : "Bạn có chắc chắn muốn rời khỏi Tông môn này không?";
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/leave');
      if (res.data && res.data.success) {
        showSuccess(res.data.message);
        setInSect(false);
        setMySectData(null);
        await loadSectInfo();
      }
    } catch (err) {
      showError(err.response?.data?.error || "Không thể rời tông môn");
    } finally {
      setActionLoading(false);
    }
  };

  const handleContribute = async (e) => {
    e.preventDefault();
    if (contribAmount <= 0) return;
    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/contribute', { amount: contribAmount });
      if (res.data && res.data.success) {
        showSuccess(res.data.message);
        const infoRes = await api.get('/api/sects/my-sect');
        if (infoRes.data) setMySectData(infoRes.data);
      }
    } catch (err) {
      showError(err.response?.data?.error || "Cống hiến thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAnnouncement = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/announcement', { announcement: editAnnouncement });
      if (res.data && res.data.success) {
        showSuccess(res.data.message);
        setIsEditingAnnouncement(false);
        const infoRes = await api.get('/api/sects/my-sect');
        if (infoRes.data) setMySectData(infoRes.data);
      }
    } catch (err) {
      showError(err.response?.data?.error || "Cập nhật thông cáo thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  // Full 5 ranks promotion handler
  const handlePromoteRank = async (targetUserId, newRole) => {
    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/promote/rank', { user_id: targetUserId, role: newRole });
      if (res.data && res.data.success) {
        showSuccess(res.data.message);
        const infoRes = await api.get('/api/sects/my-sect');
        if (infoRes.data) setMySectData(infoRes.data);
      }
    } catch (err) {
      showError(err.response?.data?.error || "Thăng/Giáng chức thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  const handleKickMember = async (userId, username) => {
    if (!window.confirm(`Bạn có chắc chắn muốn trục xuất đệ tử ${username} khỏi tông môn?`)) return;
    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/kick', { user_id: userId });
      if (res.data && res.data.success) {
        showSuccess(res.data.message);
        const infoRes = await api.get('/api/sects/my-sect');
        if (infoRes.data) setMySectData(infoRes.data);
      }
    } catch (err) {
      showError(err.response?.data?.error || "Trục xuất thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRespondRequest = async (reqId, action) => {
    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/requests/respond', { request_id: reqId, action });
      if (res.data && res.data.success) {
        showSuccess(res.data.message);
        await fetchJoinRequests();
        const infoRes = await api.get('/api/sects/my-sect');
        if (infoRes.data) setMySectData(infoRes.data);
      }
    } catch (err) {
      showError(err.response?.data?.error || "Xử lý yêu cầu thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  const handleShareBook = async (bookId) => {
    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/library/add', { book_id: bookId });
      if (res.data && res.data.success) {
        showSuccess(res.data.message);
        setShowShareModal(false);
        await fetchSectLibrary();
        const infoRes = await api.get('/api/sects/my-sect');
        if (infoRes.data) setMySectData(infoRes.data);
      }
    } catch (err) {
      showError(err.response?.data?.error || "Đóng góp truyện thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveBook = async (bookId, bookTitle) => {
    if (!window.confirm(`Bạn có chắc chắn muốn gỡ truyện '${bookTitle}' ra khỏi thư viện Tông môn?`)) return;
    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/library/remove', { book_id: bookId });
      if (res.data && res.data.success) {
        showSuccess(res.data.message);
        await fetchSectLibrary();
      }
    } catch (err) {
      showError(err.response?.data?.error || "Gỡ truyện thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  // Send message for various channels
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;
    const msgText = typedMessage.trim();
    setTypedMessage('');
    setSendingMessage(true);

    try {
      let body = { message: msgText, chat_type: chatType };
      if (chatType === 'group') body.group_id = selectedGroupId;
      if (chatType === 'direct') body.target_id = selectedDirectUser.user_id || selectedDirectUser.id;

      await api.post('/api/sects/chat/send', body);
      await fetchChatHistory();
    } catch (err) {
      showError("Gửi tin nhắn thất bại");
      setTypedMessage(msgText);
    } finally {
      setSendingMessage(false);
    }
  };

  // Create sub group chat
  const handleCreateSubGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedGroupMembers.length === 0) return;
    setActionLoading(true);
    try {
      const res = await api.post('/api/sects/chat/groups/create', {
        name: newGroupName.trim(),
        members: [user.id, ...selectedGroupMembers]
      });
      if (res.data && res.data.group_id) {
        showSuccess(`Nhóm chat '${newGroupName}' được thành lập!`);
        setShowCreateGroupModal(false);
        setNewGroupName('');
        setSelectedGroupMembers([]);
        await fetchSubGroups();
        setChatType('group');
        setSelectedGroupId(res.data.group_id);
      }
    } catch (err) {
      showError(err.response?.data?.error || "Không thể tạo nhóm chat nhỏ");
    } finally {
      setActionLoading(false);
    }
  };

  // Open settings of sub group chat
  const openGroupSettings = async (groupId) => {
    setActionLoading(true);
    try {
      const res = await api.get(`/api/sects/chat/groups/${groupId}`);
      if (res.data) {
        setActiveGroupDetail(res.data);
        setShowGroupSettingsModal(true);
      }
    } catch (err) {
      showError("Không thể xem thông tin nhóm chat nhỏ");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMemberToGroup = async (targetUserId) => {
    try {
      const res = await api.post(`/api/sects/chat/groups/${activeGroupDetail.group.id}/members/add`, {
        user_ids: [targetUserId]
      });
      if (res.data && res.data.success) {
        openGroupSettings(activeGroupDetail.group.id);
        fetchSubGroups();
      }
    } catch (e) {
      showError("Không thể thêm thành viên");
    }
  };

  const handleRemoveMemberFromGroup = async (targetUserId) => {
    try {
      const res = await api.post(`/api/sects/chat/groups/${activeGroupDetail.group.id}/members/remove`, {
        user_id: targetUserId
      });
      if (res.data && res.data.success) {
        openGroupSettings(activeGroupDetail.group.id);
        fetchSubGroups();
      }
    } catch (e) {
      showError("Không thể loại bỏ thành viên");
    }
  };

  const toggleGroupMemberSelect = (uid) => {
    setSelectedGroupMembers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  // Helper colors & badge renderer
  const renderBadge = (color, size = "w-10 h-10") => {
    const bgColors = {
      purple: 'from-purple-600 to-indigo-700 ring-purple-500/30',
      emerald: 'from-emerald-500 to-teal-700 ring-emerald-500/30',
      rose: 'from-rose-500 to-red-700 ring-rose-500/30',
      amber: 'from-amber-500 to-orange-600 ring-amber-500/30',
      blue: 'from-blue-600 to-cyan-700 ring-blue-500/30'
    };
    return (
      <div className={`${size} rounded-2xl bg-gradient-to-br ${bgColors[color] || bgColors.purple} flex items-center justify-center ring-4 shadow-lg shrink-0`}>
        <Shield className="w-1/2 h-1/2 text-white" />
      </div>
    );
  };

  const getRankBadgeColor = (role) => {
    const colors = {
      leader: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      vice_leader: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
      elder: "bg-purple-500/10 border-purple-500/30 text-purple-400",
      inner_disciple: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      member: "bg-slate-800 border-slate-700 text-slate-400",
    };
    return colors[role] || colors.member;
  };

  const isLeaderOrElder = mySectData && ['leader', 'vice_leader', 'elder'].includes(mySectData.role);

  return (
    <MainLayout>
      <div className="max-w-[1400px] mx-auto px-4 py-8 md:py-12 min-h-[calc(100vh-80px)] flex flex-col justify-start">
        
        {/* Banner Section */}
        <div className="bg-gradient-to-r from-purple-950/20 via-indigo-950/20 to-teal-950/15 border border-[#1f1f3a] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 mb-8 shadow-xl">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center justify-center md:justify-start gap-2.5">
              <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
              {lang === 'vi' ? 'Hệ thống Tông Môn & Liên Minh' : 'Sects & Alliances'}
            </h2>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              {lang === 'vi' 
                ? 'Tìm kiếm và bái kiến các tông môn danh tiếng, hoặc sáng lập một đạo thống tu tiên riêng. Phân cấp đệ tử rõ ràng, chat nhóm nhỏ cơ mật và trao đổi công pháp võ học.'
                : 'Search and join legendary sects, or establish your own lineage. Detailed rank promotions, private sub-group chats, and share library books.'}
            </p>
          </div>
          {inSect && (
            <button
              onClick={handleLeaveSect}
              className="px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white rounded-2xl border border-rose-500/20 hover:border-transparent transition-all flex items-center gap-2 text-xs font-bold shrink-0 shadow-md"
            >
              <LogOut className="w-4 h-4" />
              <span>{mySectData?.role === 'leader' ? 'Giải tán Tông Môn' : 'Rời khỏi Tông Môn'}</span>
            </button>
          )}
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-bold shadow-md">
            🎉 {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mb-6 p-4 bg-rose-950/30 border border-rose-500/30 rounded-2xl text-rose-400 text-xs font-bold shadow-md">
            ⚠️ {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500">Đang tìm kiếm thiên cơ...</span>
          </div>
        ) : !inSect ? (
          /* ==========================================
             1. USER NOT IN A SECT: LIST, SEARCH, CREATE
             ========================================== */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Create Sect */}
            <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-3xl p-6 space-y-6 shadow-xl backdrop-blur-xl">
              <h3 className="text-sm font-black tracking-wider text-purple-400 uppercase flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Sáng lập Tông Môn
              </h3>
              
              <form onSubmit={handleCreateSect} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Tên Tông Môn</label>
                  <input 
                    type="text" 
                    placeholder="ví dụ: Vô Cực Kiếm Tông..."
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#05050a] border border-[#1f1f3a] focus:border-purple-500 rounded-xl text-xs text-white outline-none transition-colors"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Tuyên ngôn / Bio</label>
                  <textarea 
                    placeholder="Tuyên ngôn tông môn..."
                    value={createSlogan}
                    onChange={(e) => setCreateSlogan(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[#05050a] border border-[#1f1f3a] focus:border-purple-500 rounded-xl text-xs text-white outline-none transition-colors resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 block">Huy hiệu Tông Môn</label>
                  <div className="flex gap-3">
                    {['purple', 'emerald', 'rose', 'amber', 'blue'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCreateBadge(color)}
                        className={`p-1 rounded-2xl border-2 transition-all ${
                          createBadge === color ? 'border-purple-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        {renderBadge(color, "w-10 h-10")}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading || !createName.trim()}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.01]"
                >
                  {actionLoading ? 'Đang thỉnh lập...' : 'Sáng lập Tông Môn'}
                </button>
              </form>
            </div>

            {/* List & Search */}
            <div className="lg:col-span-2 space-y-5">
              
              {/* Search Bar */}
              <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-3xl p-4 flex gap-2 shadow-xl backdrop-blur-xl">
                <div className="flex-1 bg-[#05050a] border border-[#1f1f3a] focus-within:border-purple-500 rounded-2xl flex items-center px-4 transition-colors">
                  <Search className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
                  <input 
                    type="text"
                    placeholder="Tìm kiếm tông môn theo tên, khẩu hiệu hoặc ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full py-3 bg-transparent text-xs text-white outline-none"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl text-xs shadow-md transition-all active:scale-95 shrink-0"
                >
                  Tìm kiếm
                </button>
              </div>

              {/* Sects List */}
              <div className="space-y-4">
                <h3 className="text-sm font-black tracking-wider text-teal-400 uppercase flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Danh sách Tông Môn giang hồ ({sectsList.length})
                </h3>

                {sectsList.length === 0 ? (
                  <div className="text-center py-24 border border-dashed border-[#1f1f3a] rounded-3xl bg-[#121225]/40 text-xs text-slate-500">
                    Không tìm thấy tông môn nào. Hãy thay đổi từ khóa hoặc tự lập môn hộ!
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {sectsList.map(s => {
                      const isPending = pendingRequests.includes(s.id);
                      return (
                        <div 
                          key={s.id} 
                          className="bg-[#121225]/60 border border-[#1f1f3a] hover:border-purple-500/20 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all shadow-lg"
                        >
                          <div 
                            onClick={() => viewSectDetail(s.id)}
                            className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row min-w-0 cursor-pointer group"
                          >
                            {renderBadge(s.badge)}
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-slate-100 group-hover:text-purple-400 transition-colors">{s.name}</span>
                                <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full text-[9px] font-bold">
                                  Cấp {s.level}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 italic truncate max-w-sm">
                                "{s.slogan || 'Tông môn chưa viết tuyên ngôn.'}"
                              </p>
                              <div className="flex items-center justify-center sm:justify-start gap-4 text-[10px] text-slate-500 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5 text-purple-400" />
                                  {s.member_count} đệ tử
                                </span>
                                <span>|</span>
                                <span>Tông chủ: <strong>{s.leader_name}</strong></span>
                                <span>|</span>
                                <span className="text-amber-500">Cống hiến: <strong>{s.contribution}</strong></span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => viewSectDetail(s.id)}
                              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all"
                            >
                              Chi tiết
                            </button>
                            <button
                              onClick={() => !isPending && handleJoinSect(s.id)}
                              disabled={actionLoading || isPending}
                              className={`px-5 py-2.5 rounded-2xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 shrink-0 ${
                                isPending 
                                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-[#1f1f3a]'
                                  : 'bg-teal-600 hover:bg-teal-500 text-white'
                              }`}
                            >
                              <span>{isPending ? 'Đang chờ...' : 'Gia nhập'}</span>
                              {!isPending && <ArrowRight className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          /* ==========================================
             2. USER ALREADY IN A SECT: REDESIGNED VIEW
             ========================================== */
          <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row flex-1 min-h-[650px] backdrop-blur-xl">
            
            {/* Left sidebar navigation */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#1f1f3a] bg-[#0b0b14]/50 flex flex-col shrink-0">
              
              <div className="p-5 border-b border-[#1f1f3a] flex items-center gap-3 bg-[#080814]/30">
                {renderBadge(mySectData.sect.badge, "w-11 h-11")}
                <div className="min-w-0">
                  <h4 className="font-extrabold text-sm text-slate-100 truncate">{mySectData.sect.name}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="px-1.5 py-0.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-full text-[8px] font-black">
                      Cấp {mySectData.sect.level}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">#{mySectData.sect.id}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-1">
                <button
                  onClick={() => setActiveSubTab('info')}
                  className={`w-full px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2.5 ${
                    activeSubTab === 'info' 
                      ? 'bg-purple-600/20 border border-purple-500/30 text-white' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Award className="w-4 h-4 text-purple-400" />
                  <span>Tổng quan tông môn</span>
                </button>

                <button
                  onClick={() => setActiveSubTab('disciples')}
                  className={`w-full px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2.5 ${
                    activeSubTab === 'disciples' 
                      ? 'bg-purple-600/20 border border-purple-500/30 text-white' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users className="w-4 h-4 text-teal-400" />
                  <span>Môn đồ & Chức vị</span>
                </button>

                {isLeaderOrElder && (
                  <button
                    onClick={() => setActiveSubTab('requests')}
                    className={`w-full px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-between ${
                      activeSubTab === 'requests' 
                        ? 'bg-purple-600/20 border border-purple-500/30 text-white' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Duyệt môn đồ</span>
                    </div>
                    {joinRequestsList.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-black text-[8px] font-black rounded-md animate-pulse">
                        {joinRequestsList.length}
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={() => setActiveSubTab('library')}
                  className={`w-full px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2.5 ${
                    activeSubTab === 'library' 
                      ? 'bg-purple-600/20 border border-purple-500/30 text-white' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span>Thư viện Tông Môn</span>
                </button>

                <button
                  onClick={() => setActiveSubTab('chat')}
                  className={`w-full px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2.5 ${
                    activeSubTab === 'chat' 
                      ? 'bg-purple-600/20 border border-purple-500/30 text-white' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-pink-400" />
                  <span>Phòng đàm đạo (Multi)</span>
                </button>

                <button
                  onClick={() => setActiveSubTab('contribute')}
                  className={`w-full px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2.5 ${
                    activeSubTab === 'contribute' 
                      ? 'bg-purple-600/20 border border-purple-500/30 text-white' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Dâng nạp linh thạch</span>
                </button>
              </div>

              {/* Personal Card */}
              <div className="mt-auto p-4 border-t border-[#1f1f3a] bg-[#05050a]/40 space-y-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Chức vị của bạn:</span>
                  <span className="font-bold text-purple-400 uppercase tracking-wider">
                    {ROLE_LABELS[mySectData.role] || 'Môn đồ'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Cống hiến riêng:</span>
                  <span className="font-bold text-amber-400">{mySectData.my_contribution} linh thạch</span>
                </div>
              </div>
            </div>

            {/* Right content view */}
            <div className="flex-1 flex flex-col bg-[#080814]/30 min-w-0">
              
              {/* TAB 1: OVERVIEW */}
              {activeSubTab === 'info' && (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-[#121225]/40 border border-[#1f1f3a] p-4 rounded-2xl text-center">
                      <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Cấp Tông Môn</span>
                      <span className="text-lg font-black text-white block mt-1">{mySectData.sect.level}</span>
                    </div>
                    <div className="bg-[#121225]/40 border border-[#1f1f3a] p-4 rounded-2xl text-center">
                      <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Tổng cống hiến</span>
                      <span className="text-lg font-black text-amber-400 block mt-1">{mySectData.sect.contribution}</span>
                    </div>
                    <div className="bg-[#121225]/40 border border-[#1f1f3a] p-4 rounded-2xl text-center">
                      <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Môn đồ hiện tại</span>
                      <span className="text-lg font-black text-purple-400 block mt-1">{mySectData.members.length}</span>
                    </div>
                    <div className="bg-[#121225]/40 border border-[#1f1f3a] p-4 rounded-2xl text-center">
                      <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Tông chủ</span>
                      <span className="text-xs font-black text-slate-300 block truncate mt-2">{mySectData.sect.leader_name}</span>
                    </div>
                  </div>

                  <div className="bg-[#121225]/40 border border-[#1f1f3a] p-5 rounded-3xl space-y-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Mục tiêu tông môn</span>
                    <p className="text-xs text-slate-300 italic">"{mySectData.sect.slogan || 'Chưa thiết lập.'}"</p>
                  </div>

                  <div className="bg-[#121225]/40 border border-[#1f1f3a] p-5 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Thông cáo tông môn</span>
                      {isLeaderOrElder && (
                        <button
                          onClick={() => setIsEditingAnnouncement(!isEditingAnnouncement)}
                          className="text-[10px] text-purple-400 hover:text-white flex items-center gap-1"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>{isEditingAnnouncement ? 'Hủy' : 'Chỉnh sửa'}</span>
                        </button>
                      )}
                    </div>

                    {isEditingAnnouncement ? (
                      <div className="space-y-3">
                        <textarea
                          rows={4}
                          value={editAnnouncement}
                          onChange={(e) => setEditAnnouncement(e.target.value)}
                          className="w-full p-3 bg-[#05050a] border border-[#1f1f3a] focus:border-purple-500 rounded-xl text-xs text-white outline-none resize-none"
                        />
                        <button
                          onClick={handleUpdateAnnouncement}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                        >
                          Lưu thông cáo
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-purple-950/10 border border-purple-500/10 rounded-2xl">
                        <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {mySectData.sect.announcement || 'Hôm nay trời quang mây tạnh, các đệ tử nỗ lực tu luyện đọc truyện.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: DISCIPLES WITH 5 RANK DROPDOWN */}
              {activeSubTab === 'disciples' && (
                <div className="p-6 space-y-4">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Danh sách đệ tử ({mySectData.members.length})</h4>
                  
                  <div className="border border-[#1f1f3a] rounded-2xl overflow-hidden divide-y divide-[#1f1f3a]">
                    {mySectData.members.map(m => {
                      const isMe = m.user_id === user.id;
                      const callerRoleVal = ROLE_ORDER[mySectData.role] || 99;
                      const targetRoleVal = ROLE_ORDER[m.role] || 99;
                      const canManage = callerRoleVal < targetRoleVal && !isMe;

                      return (
                        <div key={m.user_id} className="p-4 flex items-center justify-between gap-4 bg-[#121225]/20 hover:bg-[#121225]/40 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            {m.avatar ? (
                              <img src={m.avatar} className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-500/10" alt="avatar" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] flex items-center justify-center font-black text-xs text-white shrink-0">
                                {m.username[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold ${isMe ? 'text-purple-400' : 'text-slate-200'} truncate`}>
                                  {m.username} {isMe && '(Bạn)'}
                                </span>
                                <span className={`px-2 py-0.5 border text-[8px] font-black rounded-md uppercase tracking-wider ${getRankBadgeColor(m.role)}`}>
                                  {ROLE_LABELS[m.role] || 'Môn đồ'}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-500 block mt-0.5">
                                Gia nhập: {new Date(m.joined_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-300 block">{m.contribution}</span>
                              <span className="text-[8px] text-slate-500 block">Cống hiến</span>
                            </div>

                            {/* Dropdown 5 Ranks Promotion */}
                            {canManage ? (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={m.role}
                                  onChange={(e) => handlePromoteRank(m.user_id, e.target.value)}
                                  disabled={actionLoading}
                                  className="bg-[#05050a] border border-[#1f1f3a] text-slate-300 text-[10px] font-bold rounded-lg px-2.5 py-1.5 focus:border-purple-500 outline-none cursor-pointer"
                                >
                                  {Object.keys(ROLE_LABELS).map(roleKey => {
                                    const roleVal = ROLE_ORDER[roleKey];
                                    // Can only assign roles lower than caller's role
                                    if (roleKey !== 'leader' && roleVal > callerRoleVal) {
                                      return (
                                        <option key={roleKey} value={roleKey}>
                                          {ROLE_LABELS[roleKey]}
                                        </option>
                                      );
                                    }
                                    return null;
                                  })}
                                </select>

                                <button
                                  onClick={() => handleKickMember(m.user_id, m.username)}
                                  disabled={actionLoading}
                                  className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg transition-colors border border-rose-500/20"
                                  title="Trục xuất khỏi tông môn"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : !isMe && (
                              <button
                                onClick={() => {
                                  setChatType('direct');
                                  setSelectedDirectUser(m);
                                  setActiveSubTab('chat');
                                }}
                                className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/20 rounded-xl text-[10px] font-bold transition-all"
                              >
                                Nhắn tin
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: JOIN REQUESTS */}
              {activeSubTab === 'requests' && isLeaderOrElder && (
                <div className="p-6 space-y-4">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Đơn bái kiến đang chờ ({joinRequestsList.length})</h4>
                  
                  {joinRequestsList.length === 0 ? (
                    <div className="text-center py-20 text-xs text-slate-500 border border-dashed border-[#1f1f3a] rounded-3xl bg-[#121225]/20">
                      Không có đơn bái kiến nào đang chờ.
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {joinRequestsList.map(r => (
                        <div key={r.id} className="p-4 bg-[#121225]/40 border border-[#1f1f3a] rounded-2xl flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {r.avatar ? (
                              <img src={r.avatar} className="w-8.5 h-8.5 rounded-full object-cover ring-2 ring-purple-500/10" alt="avatar" />
                            ) : (
                              <div className="w-8.5 h-8.5 rounded-full bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center font-black text-xs text-white">
                                {r.username ? r.username[0].toUpperCase() : 'U'}
                              </div>
                            )}
                            <div>
                              <span className="text-xs font-bold text-white block">{r.username}</span>
                              <span className="text-[8px] text-slate-500 block mt-0.5">
                                Gửi yêu cầu: {new Date(r.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRespondRequest(r.id, 'approve')}
                              disabled={actionLoading}
                              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-md"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Thu nhận
                            </button>
                            <button
                              onClick={() => handleRespondRequest(r.id, 'reject')}
                              disabled={actionLoading}
                              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl text-[10px] font-bold flex items-center gap-1 border border-rose-500/20"
                            >
                              <X className="w-3.5 h-3.5" />
                              Từ chối
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SECT LIBRARY */}
              {activeSubTab === 'library' && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Thư viện chia sẻ Tông môn</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Góp ý, lưu truyền các bí tịch / truyện hay trong tông môn.</p>
                    </div>
                    <button
                      onClick={() => { fetchUserBookshelf(); setShowShareModal(true); }}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      Hiến sách (+20 cống hiến)
                    </button>
                  </div>

                  {sectBooksList.length === 0 ? (
                    <div className="text-center py-24 border border-dashed border-[#1f1f3a] rounded-3xl bg-[#121225]/20 text-xs text-slate-500">
                      Chưa có sách nào được lưu trữ trong Thư viện. Hãy cống hiến bí tịch đầu tiên!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sectBooksList.map(book => {
                        const canDelete = mySectData?.role === 'leader' || mySectData?.role === 'vice_leader' || mySectData?.role === 'elder' || book.added_by_name === user.username;
                        return (
                          <div key={book.id} className="bg-[#121225]/40 border border-[#1f1f3a] rounded-3xl p-4 flex gap-4 hover:border-purple-500/20 transition-all items-start justify-between">
                            <div className="flex gap-4 min-w-0">
                              {book.cover ? (
                                <img src={book.cover} className="w-16 h-22 object-cover rounded-lg border border-white/5 shrink-0 bg-[#0f0f1a]" alt="cover" />
                              ) : (
                                <div className="w-16 h-22 rounded-lg bg-[#0f0f1a] border border-white/5 flex items-center justify-center shrink-0 text-slate-600">
                                  <BookOpen className="w-6 h-6" />
                                </div>
                              )}
                              <div className="min-w-0 space-y-1">
                                <h5 
                                  onClick={() => navigate(`/book/${book.id}`)}
                                  className="text-xs font-bold text-slate-100 hover:text-purple-400 transition-colors cursor-pointer truncate"
                                >
                                  {book.title_vietphrase || book.title}
                                </h5>
                                <p className="text-[10px] text-slate-400 truncate">{book.author}</p>
                                <span className="text-[8px] text-slate-500 block">
                                  Hiến tặng: <strong>{book.added_by_name}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 shrink-0 items-end">
                              <button
                                onClick={() => navigate(`/book/${book.id}`)}
                                className="p-1.5 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-[9px] font-bold"
                              >
                                <span>Đọc</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              
                              {canDelete && (
                                <button
                                  onClick={() => handleRemoveBook(book.id, book.title_vietphrase || book.title)}
                                  disabled={actionLoading}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg transition-colors border border-rose-500/20"
                                  title="Gỡ khỏi thư viện"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: MULTI-CHANNEL DEEP CHAT SYSTEM */}
              {activeSubTab === 'chat' && (
                <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-[#1f1f3a]">
                  
                  {/* Channels selection bar */}
                  <div className="w-full md:w-56 bg-[#0b0b14]/30 flex flex-col p-4 space-y-4 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Kênh đàm đạo</span>
                    </div>

                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setChatType('general');
                          setSelectedGroupId(null);
                          setSelectedDirectUser(null);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2 ${
                          chatType === 'general' ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        <MessageCircle className="w-4 h-4 shrink-0" />
                        <span className="truncate">Đàm đạo chung</span>
                      </button>
                    </div>

                    {/* Sub Groups section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[9px] font-black uppercase text-slate-500">Nhóm nhỏ</span>
                        <button
                          onClick={() => setShowCreateGroupModal(true)}
                          className="p-0.5 hover:bg-white/5 rounded text-purple-400"
                          title="Tạo nhóm chat nhỏ"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                        {subGroups.length === 0 ? (
                          <span className="text-[9px] text-slate-600 italic block px-1">Chưa có nhóm nào</span>
                        ) : (
                          subGroups.map(g => (
                            <div 
                              key={g.id}
                              className={`w-full px-3 py-2 rounded-xl transition-all flex items-center justify-between text-xs font-bold ${
                                chatType === 'group' && selectedGroupId === g.id 
                                  ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20' 
                                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                              }`}
                            >
                              <button
                                onClick={() => {
                                  setChatType('group');
                                  setSelectedGroupId(g.id);
                                  setSelectedDirectUser(null);
                                }}
                                className="flex-1 text-left truncate mr-2"
                              >
                                # {g.name}
                              </button>
                              <button
                                onClick={() => openGroupSettings(g.id)}
                                className="p-0.5 hover:bg-white/10 rounded text-slate-500 hover:text-slate-300"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Active Direct chats */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-black uppercase text-slate-500 px-1 block">Chat riêng tư</span>
                      {selectedDirectUser ? (
                        <button
                          onClick={() => setChatType('direct')}
                          className="w-full px-3 py-2 bg-purple-600/10 text-purple-400 border border-purple-500/20 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2"
                        >
                          <div className="w-4 h-4 bg-purple-500/30 rounded-full flex items-center justify-center text-[8px] font-black text-purple-300">
                            {selectedDirectUser.username[0].toUpperCase()}
                          </div>
                          <span className="truncate">{selectedDirectUser.username}</span>
                        </button>
                      ) : (
                        <span className="text-[9px] text-slate-600 italic block px-1">Chọn đệ tử ở tab Môn đồ để chat riêng</span>
                      )}
                    </div>

                  </div>

                  {/* Message Stream area */}
                  <div className="flex-1 flex flex-col min-w-0">
                    
                    {/* Header info */}
                    <div className="px-4 py-3 border-b border-[#1f1f3a] bg-[#0b0b14]/30 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-xs font-black text-white block">
                          {chatType === 'general' && '🔊 Kênh đàm đạo chung'}
                          {chatType === 'group' && `👥 Nhóm chat: ${subGroups.find(g => g.id === selectedGroupId)?.name || '...'}`}
                          {chatType === 'direct' && `🔒 Chat mật với: ${selectedDirectUser?.username}`}
                        </span>
                      </div>
                    </div>

                    {/* Messages stream */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar select-text bg-[#080814]/20">
                      {chatMessages.length === 0 ? (
                        <div className="text-center py-20 text-xs text-slate-600">
                          Chưa có thảo luận nào.
                        </div>
                      ) : (
                        chatMessages.map((msg, idx) => {
                          const isMe = msg.sender_id === user.id;
                          return (
                            <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                              {!isMe && (
                                <div className="shrink-0 mt-0.5">
                                  {msg.sender_avatar ? (
                                    <img src={msg.sender_avatar} className="w-7 h-7 rounded-full object-cover ring-1 ring-purple-500/10" alt="avatar" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center font-black text-[10px] text-white">
                                      {msg.sender_name ? msg.sender_name[0].toUpperCase() : 'U'}
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="max-w-[70%] space-y-1">
                                {!isMe && (
                                  <span className="text-[9px] text-slate-500 block px-1">{msg.sender_name}</span>
                                )}
                                <div className={`p-3 rounded-2xl shadow-md text-xs leading-relaxed whitespace-pre-wrap ${
                                  isMe 
                                    ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-br-none' 
                                    : 'bg-[#121225] border border-[#1f1f3a] text-slate-200 rounded-bl-none'
                                }`}>
                                  {msg.message}
                                </div>
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

                    {/* Input form */}
                    <form onSubmit={handleSendChat} className="p-3 border-t border-[#1f1f3a] bg-[#0b0b14]/50 flex items-center gap-2 shrink-0">
                      <input 
                        type="text" 
                        placeholder={
                          chatType === 'general' ? "Thảo luận công khai..." :
                          chatType === 'group' ? "Nhắn vào nhóm nhỏ..." : "Gửi mật thư riêng..."
                        }
                        value={typedMessage}
                        onChange={(e) => setTypedMessage(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-[#05050a] border border-[#1f1f3a] rounded-2xl text-xs text-white outline-none focus:border-purple-500 transition-colors"
                      />
                      <button 
                        type="submit"
                        disabled={sendingMessage || !typedMessage.trim()}
                        className="p-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl transition-all shadow-lg active:scale-95 shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>

                  </div>

                </div>
              )}

              {/* TAB 6: CONTRIBUTE */}
              {activeSubTab === 'contribute' && (
                <div className="p-6 space-y-6">
                  <div className="bg-gradient-to-r from-amber-600/10 to-orange-600/10 border border-amber-500/20 p-5 rounded-3xl space-y-3">
                    <h4 className="text-xs font-black text-amber-400 flex items-center gap-2 uppercase tracking-wider">
                      <Coins className="w-5 h-5 text-amber-500" />
                      Quy chế cống hiến linh thạch
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Nạp Linh thạch giúp gia tăng linh mạch của tông môn, nỗ lực đột phá cấp độ tông môn mới để được giang hồ kính ngưỡng. Cứ tích lũy đủ 1000 điểm cống hiến tông môn sẽ nâng 1 cấp.
                    </p>
                  </div>

                  <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-3xl p-6 space-y-4 max-w-md shadow-lg">
                    <h5 className="text-xs font-black text-slate-200 uppercase tracking-wider">Chọn số lượng cống hiến</h5>
                    
                    <form onSubmit={handleContribute} className="space-y-4">
                      <div className="grid grid-cols-4 gap-2">
                        {[10, 50, 100, 500].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setContribAmount(val)}
                            className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                              contribAmount === val 
                                ? 'bg-amber-600/20 border-amber-500 text-amber-300' 
                                : 'bg-[#05050a] border-[#1f1f3a] text-slate-400 hover:text-white'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-500">Số lượng Linh thạch tùy chỉnh</label>
                        <input 
                          type="number" 
                          min={1}
                          value={contribAmount}
                          onChange={(e) => setContribAmount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-4 py-2.5 bg-[#05050a] border border-[#1f1f3a] focus:border-amber-500 rounded-xl text-xs text-white outline-none transition-colors"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-600/20 transition-all hover:scale-[1.01]"
                      >
                        {actionLoading ? 'Đang dâng hiến...' : 'Dâng hiến'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* MODAL 1: VIEW SECT DETAIL */}
        {showSectDetailModal && selectedSectDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-[#121225] border border-[#1f1f3a] rounded-3xl overflow-hidden shadow-2xl animate-scale-in">
              <div className="p-5 border-b border-[#1f1f3a] flex items-center justify-between bg-[#0b0b14]/50">
                <div className="flex items-center gap-3">
                  {renderBadge(selectedSectDetail.sect.badge)}
                  <div>
                    <h4 className="text-sm font-black text-white">{selectedSectDetail.sect.name}</h4>
                    <span className="text-[10px] text-teal-400 font-bold">Tông môn Cấp {selectedSectDetail.sect.level}</span>
                  </div>
                </div>
                <button onClick={() => setShowSectDetailModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-slate-500">Mục tiêu</span>
                  <p className="text-xs text-slate-300 italic">"{selectedSectDetail.sect.slogan || 'Tông môn này chưa thiết lập mục tiêu.'}"</p>
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase text-slate-500">Danh sách môn đồ ({selectedSectDetail.member_count})</span>
                  <div className="border border-[#1f1f3a] rounded-2xl overflow-hidden divide-y divide-[#1f1f3a] bg-[#05050a]/40">
                    {selectedSectDetail.members.map(m => (
                      <div key={m.user_id} className="p-3.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-300 flex items-center justify-center font-bold">
                            {m.username[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-200 block">{m.username}</span>
                            <span className="text-[8px] text-slate-500 block">Gia nhập: {new Date(m.joined_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 border text-[8px] font-black rounded-md uppercase tracking-wider ${getRankBadgeColor(m.role)}`}>
                          {ROLE_LABELS[m.role]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              <div className="p-5 border-t border-[#1f1f3a] bg-[#0b0b14]/50 flex justify-end gap-2">
                <button 
                  onClick={() => setShowSectDetailModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold"
                >
                  Đóng
                </button>
                <button
                  onClick={() => handleJoinSect(selectedSectDetail.sect.id)}
                  disabled={actionLoading || pendingRequests.includes(selectedSectDetail.sect.id)}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-xs font-black shadow-md"
                >
                  {pendingRequests.includes(selectedSectDetail.sect.id) ? 'Đã xin gia nhập' : 'Gia nhập Tông môn'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: HIẾN SÁCH */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[#121225] border border-[#1f1f3a] rounded-3xl p-6 space-y-4 shadow-2xl animate-scale-in">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <BookMarked className="w-4 h-4 text-purple-400" />
                  Hiến tặng sách
                </h4>
                <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                {userBookshelf.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-500">
                    Kệ sách của bạn đang trống rỗng.
                  </div>
                ) : (
                  userBookshelf.map(b => (
                    <div key={b.book_id} className="p-2.5 bg-[#0b0b14]/50 border border-[#1f1f3a] rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {b.cover ? (
                          <img src={b.cover} className="w-8 h-11 object-cover rounded-md border border-white/5 shrink-0" alt="cover" />
                        ) : (
                          <div className="w-8 h-11 rounded-md bg-[#0f0f1a] flex items-center justify-center shrink-0 text-slate-600 text-[10px]">
                            Cover
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-200 block truncate">{b.title}</span>
                          <span className="text-[9px] text-slate-500 block truncate">{b.author}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleShareBook(b.book_id)}
                        disabled={actionLoading}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black shrink-0 active:scale-95"
                      >
                        Hiến sách
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: TẠO NHÓM CHAT NHỎ NỘI BỘ */}
        {showCreateGroupModal && mySectData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[#121225] border border-[#1f1f3a] rounded-3xl p-6 space-y-4 shadow-2xl animate-scale-in">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-purple-400" />
                  Tập hợp nhóm chat nhỏ
                </h4>
                <button onClick={() => setShowCreateGroupModal(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubGroup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Tên nhóm chat nhỏ</label>
                  <input 
                    type="text" 
                    placeholder="ví dụ: Ban Chấp Hành, Đội Sát Ma..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#05050a] border border-[#1f1f3a] focus:border-purple-500 rounded-xl text-xs text-white outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block">Chọn đệ tử tham gia</label>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border border-[#1f1f3a] rounded-2xl p-2 bg-[#05050a]/40 no-scrollbar">
                    {mySectData.members
                      .filter(m => m.user_id !== user.id)
                      .map(m => (
                        <label 
                          key={m.user_id} 
                          className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox"
                              checked={selectedGroupMembers.includes(m.user_id)}
                              onChange={() => toggleGroupMemberSelect(m.user_id)}
                              className="rounded border-[#1f1f3a] text-purple-600 focus:ring-0"
                            />
                            <span className="text-slate-300 font-bold">{m.username}</span>
                          </div>
                          <span className="text-[8.5px] text-slate-500 font-mono">({ROLE_LABELS[m.role] || 'Môn đồ'})</span>
                        </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading || !newGroupName.trim() || selectedGroupMembers.length === 0}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/20 active:scale-95"
                >
                  {actionLoading ? 'Đang triệu tập...' : 'Triệu tập nhóm chat'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: QUẢN LÝ THÀNH VIÊN NHÓM CHAT NHỎ */}
        {showGroupSettingsModal && activeGroupDetail && mySectData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-[#121225] border border-[#1f1f3a] rounded-3xl overflow-hidden shadow-2xl animate-scale-in">
              <div className="p-5 border-b border-[#1f1f3a] flex items-center justify-between bg-[#0b0b14]/50">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  Cài đặt: {activeGroupDetail.group.name}
                </h4>
                <button onClick={() => setShowGroupSettingsModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                
                {/* Current members in group */}
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase text-slate-500 block">Thành viên trong nhóm ({activeGroupDetail.member_count})</span>
                  <div className="border border-[#1f1f3a] rounded-2xl p-2 space-y-1 max-h-40 overflow-y-auto no-scrollbar bg-[#05050a]/40">
                    {activeGroupDetail.members.map(m => {
                      const isCreator = activeGroupDetail.group.creator_id === user.id;
                      const isMe = m.user_id === user.id;
                      const canDelete = isCreator && !isMe;
                      
                      return (
                        <div key={m.user_id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-300">{m.username}</span>
                            <span className="text-[8.5px] text-slate-500">({ROLE_LABELS[m.role] || 'Môn đồ'})</span>
                          </div>
                          {canDelete && (
                            <button 
                              onClick={() => handleRemoveMemberFromGroup(m.user_id)}
                              className="p-1 text-rose-400 hover:bg-rose-500/10 rounded-lg"
                              title="Loại khỏi nhóm"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Invite other members from Sect to group */}
                {activeGroupDetail.group.creator_id === user.id && (
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Thêm môn đồ trong tông vào nhóm</span>
                    <div className="border border-[#1f1f3a] rounded-2xl p-2 space-y-1 max-h-40 overflow-y-auto no-scrollbar bg-[#05050a]/40">
                      {mySectData.members
                        .filter(m => !activeGroupDetail.members.some(am => am.user_id === m.user_id))
                        .map(m => (
                          <div key={m.user_id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl text-xs">
                            <span className="font-bold text-slate-300">{m.username}</span>
                            <button
                              onClick={() => handleAddMemberToGroup(m.user_id)}
                              className="p-1 text-teal-400 hover:bg-teal-500/10 rounded-lg"
                              title="Thêm vào nhóm"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
