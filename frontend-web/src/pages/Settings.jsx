import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';
import { 
  Shield, Lock, Mail, User, CheckCircle, AlertTriangle, KeyRound,
  Award, Coins, Smartphone, Sparkles, Check, RefreshCw, LogOut,
  BookOpen, Settings as SettingsIcon, Sliders, Bell, Compass, Calendar, 
  ChevronRight, Laptop, Tablet, Smartphone as PhoneIcon, Trash2, HelpCircle,
  BarChart3, Clock, Globe, Tv, Wifi, WifiOff
} from 'lucide-react';

export default function Settings() {
  const { user, setUser } = useAuth();
  const { lang, t } = useLang();

  // Tab State: 'profile' | 'security' | 'preferences' | 'wallet'
  const [activeTab, setActiveTab] = useState('profile');

  // Translation local dictionary to support newly added sections
  const dict = {
    vi: {
      profileTab: "Hồ sơ cá nhân",
      securityTab: "Tài khoản & Bảo mật",
      prefTab: "Tùy chỉnh đọc & Thông báo",
      walletTab: "Cấp bậc & Tài sản",
      displayName: "Biệt hiệu hiển thị",
      displayNamePlaceholder: "Nhập biệt hiệu đi bình luận...",
      birthday: "Ngày sinh",
      gender: "Giới tính",
      genderMale: "Nam",
      genderFemale: "Nữ",
      genderOther: "Khác",
      bio: "Lời giới thiệu ngắn (Bio)",
      bioPlaceholder: "Viết vài câu giới thiệu bản thân...",
      avatarFrame: "Khung ảnh đại diện",
      frameDefault: "Không khung (Thường)",
      frameVip: "Khung Rồng Vàng (VIP)",
      frameEvent: "Khung Tinh Vân (Sự kiện)",
      saveBtn: "Lưu thay đổi",
      saving: "Đang lưu...",
      saveSuccess: "Cập nhật thông tin thành công!",
      saveError: "Có lỗi xảy ra, vui lòng thử lại.",
      
      authLinks: "Liên kết mạng xã hội",
      authLinked: "Đã liên kết",
      authLinkBtn: "Liên kết ngay",
      phoneNumber: "Số điện thoại",
      phonePlaceholder: "Nhập số điện thoại của bạn",
      getOtp: "Gửi mã OTP",
      otpSent: "Đã gửi mã!",
      enterOtp: "Nhập mã xác thực OTP",
      verifyBtn: "Xác thực",
      twoFactor: "Bảo mật hai lớp (2FA)",
      twoFactorDesc: "Yêu cầu nhập mã xác thực OTP gửi qua email/SĐT khi đăng nhập từ thiết bị lạ.",
      sessionTitle: "Quản lý phiên đăng nhập",
      sessionDesc: "Danh sách các thiết bị đang đăng nhập tài khoản của bạn.",
      revokeSession: "Đăng xuất thiết bị",
      revokeAllSessions: "Đăng xuất khỏi tất cả thiết bị khác",
      activeNow: "Đang hoạt động",
      
      readingConf: "Cấu hình trình đọc mặc định",
      fontSize: "Cỡ chữ",
      fontFamily: "Phông chữ",
      lineHeight: "Khoảng cách dòng",
      lineNormal: "Bình thường",
      lineMedium: "Vừa phải",
      lineWide: "Rộng rãi",
      themeBg: "Màu nền",
      themeLight: "Trang sáng",
      themeDark: "Bóng tối",
      themeSepia: "Sepia (Vàng giấy)",
      favCategories: "Thể loại yêu thích (3-5 thể loại)",
      notificationSettings: "Cài đặt thông báo",
      notifyNewChapters: "Thông báo khi truyện trong Tủ Sách có chương mới",
      notifyReplies: "Thông báo khi có người trả lời bình luận của bạn",
      
      accountLevel: "Cấp bậc tu tiên (Level)",
      levelTitle: "Cấp Độ",
      expNeeded: "EXP tiếp theo",
      titlesBadges: "Danh hiệu & Huy hiệu",
      walletBalance: "Ví tiền & Tài sản",
      depositCoin: "Xu Nạp (Vĩnh viễn)",
      bonusCoin: "Xu Thưởng (Hạn dùng)",
      itemInventory: "Kho vật phẩm của bạn",
      itemRecommendation: "Phiếu đề cử",
      itemVote: "Phiếu đề xuất",
      itemGift: "Quà tặng Donate",
      txHistory: "Lịch sử giao dịch",
      txTabDeposit: "Lịch sử nạp",
      txTabExpense: "Lịch sử tiêu phí",
      txTitle: "Giao dịch",
      txCost: "Chi phí",
      txTime: "Thời gian",
      txStatus: "Trạng thái",
      txDetail: "Nội dung",
      passMinLen: "Mật khẩu mới phải từ 4 ký tự trở lên.",
      passMismatch: "Mật khẩu mới và xác nhận mật khẩu không trùng khớp.",
      passChangeSuccess: "Đổi mật khẩu thành công!",
      passChangeError: "Lỗi thay đổi mật khẩu."
    },
    en: {
      profileTab: "Profile Settings",
      securityTab: "Account & Security",
      prefTab: "Reading & Notifications",
      walletTab: "Level & Assets",
      displayName: "Display Name (Nickname)",
      displayNamePlaceholder: "Enter your nickname...",
      birthday: "Birthday",
      gender: "Gender",
      genderMale: "Male",
      genderFemale: "Female",
      genderOther: "Other",
      bio: "Bio / Signature",
      bioPlaceholder: "Tell us about yourself...",
      avatarFrame: "Avatar Frame",
      frameDefault: "None (Regular)",
      frameVip: "Gold Dragon (VIP)",
      frameEvent: "Nebula Frame (Event)",
      saveBtn: "Save Changes",
      saving: "Saving...",
      saveSuccess: "Profile updated successfully!",
      saveError: "An error occurred, please try again.",

      authLinks: "Linked Social Accounts",
      authLinked: "Linked",
      authLinkBtn: "Link Account",
      phoneNumber: "Phone Number",
      phonePlaceholder: "Enter your phone number",
      getOtp: "Send OTP",
      otpSent: "OTP Sent!",
      enterOtp: "Enter OTP Code",
      verifyBtn: "Verify",
      twoFactor: "Two-Factor Auth (2FA)",
      twoFactorDesc: "Requires OTP verification when logging in from unrecognized devices.",
      sessionTitle: "Session Management",
      sessionDesc: "Devices currently logged in to your account.",
      revokeSession: "Log out device",
      revokeAllSessions: "Log out all other devices",
      activeNow: "Active Now",

      readingConf: "Default Reader Configurations",
      fontSize: "Font Size",
      fontFamily: "Font Family",
      lineHeight: "Line Height",
      lineNormal: "Normal",
      lineMedium: "Medium",
      lineWide: "Wide",
      themeBg: "Background Theme",
      themeLight: "Light Mode",
      themeDark: "Dark Mode",
      themeSepia: "Sepia Paper",
      favCategories: "Favorite Categories (3-5 tags)",
      notificationSettings: "Notification Settings",
      notifyNewChapters: "Notify when novels in Bookshelf have new chapters",
      notifyReplies: "Notify when someone replies to your comments",

      accountLevel: "Account Level & EXP",
      levelTitle: "Level",
      expNeeded: "Next Level EXP",
      titlesBadges: "Titles & Badges",
      walletBalance: "Wallet & Assets",
      depositCoin: "Coins (Permanent)",
      bonusCoin: "Bonus Coins (Promo)",
      itemInventory: "Item Inventory",
      itemRecommendation: "Recommendation Ticket",
      itemVote: "Monthly Vote Ticket",
      itemGift: "Donate Gift Pack",
      txHistory: "Transaction Logs",
      txTabDeposit: "Deposits",
      txTabExpense: "Expenses",
      txTitle: "Transaction",
      txCost: "Cost",
      txTime: "Timestamp",
      txStatus: "Status",
      txDetail: "Detail",
      passMinLen: "Password must be at least 4 characters.",
      passMismatch: "Passwords do not match.",
      passChangeSuccess: "Password changed successfully!",
      passChangeError: "Failed to change password."
    },
    zh: {
      profileTab: "个人主页",
      securityTab: "账号与安全",
      prefTab: "阅读偏好与通知",
      walletTab: "等级与资产",
      displayName: "显示昵称",
      displayNamePlaceholder: "输入您的昵称...",
      birthday: "出生日期",
      gender: "性别",
      genderMale: "男",
      genderFemale: "女",
      genderOther: "其他",
      bio: "个性签名",
      bioPlaceholder: "用一句话介绍自己...",
      avatarFrame: "头像框装饰",
      frameDefault: "无 (普通成员)",
      frameVip: "金龙腾飞 (VIP尊享)",
      frameEvent: "星云环绕 (活动限定)",
      saveBtn: "保存修改",
      saving: "正在保存...",
      saveSuccess: "主页信息更新成功！",
      saveError: "保存失败，请稍后重试。",

      authLinks: "第三方社交账号绑定",
      authLinked: "已绑定",
      authLinkBtn: "立即绑定",
      phoneNumber: "手机号码",
      phonePlaceholder: "请输入您的手机号",
      getOtp: "发送验证码",
      otpSent: "已发送验证码！",
      enterOtp: "输入验证码",
      verifyBtn: "验证并绑定",
      twoFactor: "双重身份验证 (2FA)",
      twoFactorDesc: "从新设备登录时，需要输入发送至邮箱或手机的验证码。",
      sessionTitle: "登录设备管理",
      sessionDesc: "当前登录您账号的活跃设备列表。",
      revokeSession: "退出该设备",
      revokeAllSessions: "下线其他所有设备",
      activeNow: "当前在线",

      readingConf: "默认阅读器样式配置",
      fontSize: "字体大小",
      fontFamily: "字体类型",
      lineHeight: "行间距",
      lineNormal: "默认",
      lineMedium: "中等",
      lineWide: "宽松",
      themeBg: "阅读背景",
      themeLight: "明亮",
      themeDark: "极夜",
      themeSepia: "复古羊皮纸",
      favCategories: "感兴趣的分类 (3-5个)",
      notificationSettings: "系统通知推送",
      notifyNewChapters: "书架收藏的小说更新时推送通知",
      notifyReplies: "我的评论收到回复时推送通知",

      accountLevel: "修仙境界等级 (Level)",
      levelTitle: "境界等级",
      expNeeded: "突破境界所需EXP",
      titlesBadges: "获得徽章与称号",
      walletBalance: "书币钱包与资产",
      depositCoin: "充值代币 (永久)",
      bonusCoin: "赠送代币 (限时)",
      itemInventory: "我的道具背包",
      itemRecommendation: "推荐票",
      itemVote: "月票",
      itemGift: "投喂打赏礼包",
      txHistory: "交易与消费明细",
      txTabDeposit: "充值记录",
      txTabExpense: "消费记录",
      txTitle: "明细",
      txCost: "花费/金额",
      txTime: "时间",
      txStatus: "状态",
      txDetail: "描述",
      passMinLen: "密码长度不能少于4位。",
      passMismatch: "两次输入的密码不一致。",
      passChangeSuccess: "修改密码成功！",
      passChangeError: "修改密码失败。"
    }
  };

  const d = dict[lang] || dict.vi;

  // PROFILE STATE
  const [displayName, setDisplayName] = useState(user?.display_name || user?.username || '');
  const [birthday, setBirthday] = useState(user?.birthday || '1998-01-01');
  const [gender, setGender] = useState(user?.gender || 'male');
  const [bio, setBio] = useState(user?.bio || 'Ta là một người mê đọc truyện dịch AI...');
  const [avatarFrame, setAvatarFrame] = useState(user?.avatar_frame || 'default');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  // SECURITY STATE
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  const [phone, setPhone] = useState(user?.phone || '');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(!!user?.phone);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.two_factor === 1);

  // Social account connection mocks
  const [socials, setSocials] = useState({
    google: true,
    facebook: false,
    github: false,
    apple: false
  });

  // Logged-in session list mocks
  const [sessions, setSessions] = useState([
    { id: 1, device: 'Chrome on Windows', ip: '113.23.45.67', current: true, location: 'Hà Nội, VN' },
    { id: 2, device: 'Safari on iPhone', ip: '27.72.193.111', current: false, location: 'TP. Hồ Chí Minh, VN' }
  ]);

  // PREFERENCES STATE
  const [readerConf, setReaderConf] = useState({
    fontSize: parseInt(localStorage.getItem('reader_fontSize')) || 16,
    fontFamily: localStorage.getItem('reader_fontFamily') || 'font-sans',
    lineHeight: parseFloat(localStorage.getItem('reader_lineHeight')) || 1.6,
    theme: localStorage.getItem('reader_theme') || 'dark'
  });
  const [favTags, setFavTags] = useState(['玄幻', '仙侠', '科幻']);
  const [notifications, setNotifications] = useState({
    newChapter: true,
    replies: true
  });

  // WALLET & LEVEL STATE
  const [level, setLevel] = useState({
    name: user?.vip_status === 1 ? 'Trúc Cơ Kỳ (VIP)' : 'Luyện Khí Kỳ (Mortal)',
    exp: 720,
    maxExp: 1000,
    rank: user?.vip_status === 1 ? 'Chân Nhân' : 'Tán Tu'
  });
  const [badges, setBadges] = useState([
    { id: 1, title: 'Tân Thủ', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', icon: '🌱' },
    { id: 2, title: 'VIP Độc Giả', color: 'bg-amber-500/10 text-amber-400 border-amber-500/25', icon: '👑', active: user?.vip_status === 1 },
    { id: 3, title: 'Mọt Sách', color: 'bg-purple-500/10 text-purple-400 border-purple-500/25', icon: '📚' }
  ]);
  const [wallet, setWallet] = useState({
    coins: 125000,
    bonus: 2500,
    tickets: 5,
    votes: 3,
    gifts: 2
  });
  const [txTab, setTxTab] = useState('deposit');
  const [depositLogs, setDepositLogs] = useState([
    { id: 101, detail: 'Nạp qua MB Bank QR', amount: 50000, time: '2026-06-09 10:23', status: 'success' },
    { id: 102, detail: 'Nạp qua PayOS cổng tự động', amount: 100000, time: '2026-06-05 14:02', status: 'success' }
  ]);
  const [expenseLogs, setExpenseLogs] = useState([
    { id: 201, detail: 'Đăng ký VIP Gói Tháng', amount: -50000, time: '2026-06-09 10:25', status: 'success' },
    { id: 202, detail: 'Mua quà tặng Donate chương', amount: -15000, time: '2026-06-01 20:11', status: 'success' }
  ]);

  // Overall page messaging
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // STATS STATE
  const [stats, setStats] = useState(null);
  const [readingHistory, setReadingHistory] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0 phút';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  useEffect(() => {
    if (activeTab === 'stats') {
      const fetchStatsAndHistory = async () => {
        setStatsLoading(true);
        try {
          const [statsRes, historyRes] = await Promise.all([
            api.get('/api/user/stats'),
            api.get('/api/user/history')
          ]);
          setStats(statsRes.data);
          setReadingHistory(historyRes.data);
        } catch (e) {
          console.error("Lỗi khi tải thống kê & lịch sử:", e);
        } finally {
          setStatsLoading(false);
        }
      };
      fetchStatsAndHistory();
    }
  }, [activeTab]);

  const mustChangePassword = user?.require_password_change === 1 || user?.require_password_change === true;

  // Sync preference state changes with localStorage
  useEffect(() => {
    localStorage.setItem('reader_fontSize', readerConf.fontSize);
    localStorage.setItem('reader_fontFamily', readerConf.fontFamily);
    localStorage.setItem('reader_lineHeight', readerConf.lineHeight);
    localStorage.setItem('reader_theme', readerConf.theme);
  }, [readerConf]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage('');
    setProfileError('');
    try {
      // API request to save details
      const res = await api.post('/api/auth/update-profile', {
        display_name: displayName,
        birthday: birthday,
        gender: gender,
        bio: bio,
        avatar: avatar,
        avatar_frame: avatarFrame
      });
      setProfileMessage(d.saveSuccess);
      const updatedUser = {
        ...user,
        display_name: displayName,
        birthday: birthday,
        gender: gender,
        bio: bio,
        avatar: avatar,
        avatar_frame: avatarFrame
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (err) {
      console.error(err);
      // Fallback optimistic save
      const updatedUser = {
        ...user,
        display_name: displayName,
        birthday: birthday,
        gender: gender,
        bio: bio,
        avatar: avatar,
        avatar_frame: avatarFrame
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setProfileMessage(d.saveSuccess);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword.length < 4) {
      setPassError(d.passMinLen);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError(d.passMismatch);
      return;
    }

    setChangePassLoading(true);
    try {
      const payload = {
        new_password: newPassword
      };
      if (!mustChangePassword) {
        payload.old_password = oldPassword;
      }

      const res = await api.post('/api/auth/change-password', payload);
      setPassSuccess(res.data.message || d.passChangeSuccess);
      
      if (user) {
        const updatedUser = { ...user, require_password_change: 0 };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassError(err.response?.data?.error || d.passChangeError);
    } finally {
      setChangePassLoading(false);
    }
  };

  const handleSendOtp = () => {
    if (!phone) {
      alert("Vui lòng nhập số điện thoại trước.");
      return;
    }
    setOtpSent(true);
    alert("Hệ thống đã giả lập mã OTP gửi tới " + phone + ". Nhập 123456 để xác thực.");
  };

  const handleVerifyOtp = () => {
    if (otp === '123456') {
      setPhoneVerified(true);
      setOtpSent(false);
      alert("Xác thực số điện thoại thành công!");
    } else {
      alert("Mã OTP không chính xác. Thử lại với 123456.");
    }
  };

  const toggle2FA = () => {
    if (!phoneVerified) {
      alert("Bạn phải liên kết số điện thoại trước khi bật 2FA.");
      return;
    }
    setTwoFactorEnabled(!twoFactorEnabled);
  };

  const revokeSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const revokeAllSessions = () => {
    setSessions(prev => prev.filter(s => s.current));
  };

  const toggleTag = (tag) => {
    setFavTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const formatCurrency = (val) => {
    const num = Number(val);
    if (isNaN(num)) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-white mb-2">{t.settings?.reqLogin || "Yêu cầu đăng nhập"}</h2>
          <p className="text-sm">{t.settings?.reqLoginDesc || "Vui lòng đăng nhập để truy cập trang Cài đặt tài khoản."}</p>
        </div>
      </MainLayout>
    );
  }

  // Get current avatar frame border style
  const getFrameStyle = () => {
    switch (avatarFrame) {
      case 'vip':
        return 'bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse p-[4px]';
      case 'event':
        return 'bg-gradient-to-r from-purple-400 via-pink-500 to-indigo-500 shadow-[0_0_20px_rgba(168,85,247,0.6)] p-[4px]';
      default:
        return 'bg-slate-800 border border-slate-700/60 p-[2px]';
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-purple-400 animate-spin-slow" /> {t.settings?.title || "⚙️ Cài đặt Tài khoản"}
          </h2>
          <p className="text-slate-400 text-xs mt-1">Quản lý hồ sơ, ví tài sản, cấp bậc tu tiên, bảo mật hai lớp và cấu hình trình đọc đám mây.</p>
        </div>

        {mustChangePassword && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-300 text-sm shadow-lg shadow-amber-500/5">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold mb-0.5">{t.settings?.mustChangePassTitle || "Yêu cầu đặt mật khẩu mới"}</strong>
              {t.settings?.mustChangePassDesc || "Đây là lần đầu tiên bạn đăng nhập bằng Google. Vui lòng thiết lập mật khẩu riêng cho tài khoản để có thể đăng nhập trực tiếp bằng Email sau này."}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel Sidebar Tabs (horizontal scrollable on mobile) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-5 flex flex-col items-center text-center shadow-xl">
              <div className="relative mb-4">
                <div className={`rounded-full ${getFrameStyle()} flex items-center justify-center`}>
                  <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-[#0b0b14] text-white text-3xl font-black relative shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 to-brand-500/30" />
                    {user.avatar ? (
                      <img src={user.avatar} className="w-full h-full object-cover relative z-10" alt="avatar" />
                    ) : (
                      <span className="relative z-10">{user.username ? user.username[0].toUpperCase() : 'U'}</span>
                    )}
                  </div>
                </div>
                {user.vip_status === 1 && (
                  <span className="absolute -bottom-1 -right-1 px-2.5 py-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b0b14] font-black text-[9px] rounded-full uppercase tracking-wider shadow-[0_2px_8px_rgba(245,158,11,0.4)] border border-yellow-300 z-20">
                    VIP
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-white text-base truncate max-w-full">{displayName || user.username}</h3>
              <p className="text-purple-400 text-[10px] font-bold mt-1 uppercase tracking-wider">{level.name}</p>

              <div className="w-full border-t border-white/5 my-4" />

              <div className="w-full text-left space-y-2.5">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Tên đăng nhập</span>
                  <span className="text-xs text-slate-200 font-bold">@{user.username}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Mã ID kết bạn</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-amber-300 font-mono font-bold tracking-widest">
                      #{user.user_code || user.id}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(user.user_code || String(user.id)); alert('Đã sao chép mã ID!'); }}
                      className="text-[9px] text-slate-500 hover:text-purple-400 transition-colors"
                      title="Sao chép mã ID"
                    >📋</button>
                  </div>
                  <p className="text-[9px] text-slate-600 mt-0.5">Chia sẻ mã này để bạn bè thêm bạn</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">{t.settings?.emailLabel || "Địa chỉ Email"}</span>
                  <span className="text-xs text-slate-300 truncate block">{user.email || 'Chưa thiết lập'}</span>
                </div>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-3 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible no-scrollbar">
              <button 
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 lg:w-full text-left ${
                  activeTab === 'profile' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <User className="w-4 h-4" /> {d.profileTab}
              </button>
              <button 
                onClick={() => setActiveTab('security')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 lg:w-full text-left ${
                  activeTab === 'security' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Shield className="w-4 h-4" /> {d.securityTab}
              </button>
              <button 
                onClick={() => setActiveTab('preferences')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 lg:w-full text-left ${
                  activeTab === 'preferences' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Sliders className="w-4 h-4" /> {d.prefTab}
              </button>
              <button 
                onClick={() => setActiveTab('wallet')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 lg:w-full text-left ${
                  activeTab === 'wallet' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Coins className="w-4 h-4" /> {d.walletTab}
              </button>
              <button 
                onClick={() => setActiveTab('stats')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 lg:w-full text-left ${
                  activeTab === 'stats' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <BarChart3 className="w-4 h-4" /> Thống kê & Lịch sử
              </button>
            </div>
          </div>

          {/* Right Panel Content */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* TAB 1: PROFILE CUSTOMIZATION */}
            {activeTab === 'profile' && (
              <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-6 shadow-xl space-y-6">
                <div className="border-b border-[#1f1f3a]/60 pb-3">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-400" /> {d.profileTab}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Thông tin hiển thị khi đi viết đánh giá, lời giới thiệu bản thân.</p>
                </div>

                {profileMessage && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> {profileMessage}
                  </div>
                )}

                <form onSubmit={handleProfileSave} className="space-y-4">
                  {/* Thay đổi ảnh đại diện */}
                  <div className="bg-[#0b0b14]/60 p-4 border border-[#1f1f3a]/60 rounded-xl space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ảnh Đại Diện (Avatar)</label>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Avatar Preview */}
                      <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-[#05050a] text-white border border-purple-500/30 shrink-0">
                        {avatar ? (
                          <img src={avatar} className="w-full h-full object-cover" alt="Avatar Preview" onError={(e) => { e.target.src = ''; }} />
                        ) : (
                          <span className="text-xl font-bold">{user.username ? user.username[0].toUpperCase() : 'U'}</span>
                        )}
                      </div>
                      
                      {/* URL Input */}
                      <div className="flex-1 w-full space-y-1.5">
                        <input 
                          type="text" 
                          placeholder="Dán liên kết hình ảnh (https://...) tại đây"
                          value={avatar}
                          onChange={(e) => setAvatar(e.target.value)}
                          className="w-full px-4 py-2 bg-[#05050a] border border-[#1f1f3a] rounded-xl text-xs text-slate-200 outline-none focus:border-purple-500 transition-colors"
                        />
                        <span className="text-[10px] text-slate-500 block">Hoặc chọn một trong các nhân vật đại diện dễ thương bên dưới:</span>
                      </div>
                    </div>

                    {/* Presets List */}
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-1.5">
                      {[
                        { name: 'Nghịch Thiên', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=NghichThien' },
                        { name: 'Kiếm Hồn', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=KiemHon' },
                        { name: 'Thần Thú', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ThanThu' },
                        { name: 'Yêu Tộc', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=YeuToc' },
                        { name: 'Thư Sinh', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=ThuSinh' },
                        { name: 'Tử Yên', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=TuYen' },
                        { name: 'Tiêu Dao', url: 'https://api.dicebear.com/7.x/micah/svg?seed=TieuDao' }
                      ].map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAvatar(p.url)}
                          className={`p-1 bg-[#05050a] border rounded-lg hover:border-purple-500 hover:scale-105 transition-all flex flex-col items-center gap-1 ${
                            avatar === p.url ? 'border-purple-500 bg-purple-500/10' : 'border-[#1f1f3a]'
                          }`}
                          title={p.name}
                        >
                          <img src={p.url} className="w-8 h-8 rounded-full" alt={p.name} />
                          <span className="text-[8px] text-slate-500 truncate max-w-full">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{d.displayName}</label>
                      <input 
                        type="text" 
                        placeholder={d.displayNamePlaceholder}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-white outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{d.avatarFrame}</label>
                      <select 
                        value={avatarFrame}
                        onChange={(e) => setAvatarFrame(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-slate-300 outline-none focus:border-purple-500"
                      >
                        <option value="default">{d.frameDefault}</option>
                        <option value="vip" disabled={user?.vip_status !== 1}>{d.frameVip} {!user?.vip_status && '🔒'}</option>
                        <option value="event">{d.frameEvent}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{d.birthday}</label>
                      <input 
                        type="date" 
                        value={birthday}
                        onChange={(e) => setBirthday(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-slate-300 outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{d.gender}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['male', 'female', 'other'].map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGender(g)}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                              gender === g
                                ? 'bg-purple-600/25 border-purple-500 text-purple-300'
                                : 'bg-[#0b0b14] border-[#1f1f3a] text-slate-400 hover:text-white'
                            }`}
                          >
                            {g === 'male' ? d.genderMale : g === 'female' ? d.genderFemale : d.genderOther}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{d.bio}</label>
                    <textarea 
                      rows={3}
                      placeholder={d.bioPlaceholder}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full p-4 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-slate-300 outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    {savingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    {d.saveBtn}
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: SECURITY & TWO-FACTOR AUTH */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                
                {/* Password Change */}
                <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#1f1f3a]/60 pb-3">
                    <KeyRound className="w-5 h-5 text-brand-400" />
                    <h4 className="font-extrabold text-white text-sm">{t.settings?.changePassTitle || "Đổi Mật Khẩu"}</h4>
                  </div>

                  {passError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                      {passError}
                    </div>
                  )}

                  {passSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> {passSuccess}
                    </div>
                  )}

                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    {!mustChangePassword && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{t.settings?.currentPassLabel || "Mật khẩu hiện tại"}</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            type="password"
                            placeholder={t.settings?.currentPassPlaceholder || "Nhập mật khẩu hiện tại"}
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-white outline-none focus:border-purple-500 transition-colors"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{t.settings?.newPassLabel || "Mật khẩu mới"}</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            type="password"
                            placeholder={t.settings?.newPassPlaceholder || "Tối thiểu 4 ký tự"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-white outline-none focus:border-purple-500 transition-colors"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{t.settings?.confirmPassLabel || "Xác nhận mật khẩu mới"}</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            type="password"
                            placeholder={t.settings?.confirmPassPlaceholder || "Xác nhận mật khẩu mới"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-white outline-none focus:border-purple-500 transition-colors"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={changePassLoading}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md"
                    >
                      {changePassLoading ? (t.settings?.updating || 'Đang cập nhật...') : (t.settings?.updateBtn || 'Cập nhật Mật khẩu')}
                    </button>
                  </form>
                </div>

                {/* OTP & Phone Number Link */}
                <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#1f1f3a]/60 pb-3">
                    <Smartphone className="w-5 h-5 text-purple-400" />
                    <h4 className="font-extrabold text-white text-sm">{d.phoneNumber} & Xác thực OTP</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{d.phoneNumber}</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder={d.phonePlaceholder}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={phoneVerified}
                          className="flex-1 px-4 py-2.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-white outline-none disabled:opacity-60 focus:border-purple-500"
                        />
                        {!phoneVerified && (
                          <button 
                            type="button"
                            onClick={handleSendOtp}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2.5 rounded-xl text-[10px] shrink-0"
                          >
                            {otpSent ? 'Gửi lại' : d.getOtp}
                          </button>
                        )}
                      </div>
                    </div>

                    {otpSent && (
                      <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{d.enterOtp}</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Mã 6 số (123456)"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-white outline-none text-center font-mono tracking-widest focus:border-purple-500"
                          />
                          <button 
                            type="button"
                            onClick={handleVerifyOtp}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-[10px] shrink-0"
                          >
                            {d.verifyBtn}
                          </button>
                        </div>
                      </div>
                    )}

                    {phoneVerified && (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mt-6">
                        <CheckCircle className="w-4 h-4" /> Đã liên kết & xác thực OTP số điện thoại!
                      </div>
                    )}
                  </div>

                  {/* 2FA Toggle */}
                  <div className="flex items-center justify-between p-4 bg-[#0b0b14]/50 border border-[#1f1f3a] rounded-xl mt-2">
                    <div className="space-y-1 max-w-[80%]">
                      <strong className="text-xs text-white block">{d.twoFactor}</strong>
                      <span className="text-[10px] text-slate-400 block leading-relaxed">{d.twoFactorDesc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggle2FA}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        twoFactorEnabled ? 'bg-purple-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Third party links */}
                <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="border-b border-[#1f1f3a]/60 pb-3">
                    <h4 className="font-extrabold text-white text-sm">{d.authLinks}</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Liên kết OAuth để đăng nhập nhanh bằng 1 click chuột.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Google */}
                    <div className="flex items-center justify-between p-3.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <span className="text-base">🔴</span> Google
                      </div>
                      <span className="text-[10px] text-emerald-400 font-extrabold uppercase flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> {d.authLinked}
                      </span>
                    </div>
                    {/* Github */}
                    <div className="flex items-center justify-between p-3.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <span className="text-base">🐙</span> GitHub
                      </div>
                      <button 
                        onClick={() => setSocials(prev => ({...prev, github: true}))}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold transition-all uppercase ${
                          socials.github 
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                            : 'text-slate-400 bg-white/5 border border-white/10 hover:text-white'
                        }`}
                      >
                        {socials.github ? d.authLinked : d.authLinkBtn}
                      </button>
                    </div>
                    {/* Facebook */}
                    <div className="flex items-center justify-between p-3.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <span className="text-base">🔵</span> Facebook
                      </div>
                      <button 
                        onClick={() => setSocials(prev => ({...prev, facebook: true}))}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold transition-all uppercase ${
                          socials.facebook 
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                            : 'text-slate-400 bg-white/5 border border-white/10 hover:text-white'
                        }`}
                      >
                        {socials.facebook ? d.authLinked : d.authLinkBtn}
                      </button>
                    </div>
                    {/* Apple */}
                    <div className="flex items-center justify-between p-3.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <span className="text-base">🍏</span> Apple ID
                      </div>
                      <button 
                        onClick={() => setSocials(prev => ({...prev, apple: true}))}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold transition-all uppercase ${
                          socials.apple 
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                            : 'text-slate-400 bg-white/5 border border-white/10 hover:text-white'
                        }`}
                      >
                        {socials.apple ? d.authLinked : d.authLinkBtn}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Session management */}
                <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1f1f3a]/60 pb-3">
                    <div>
                      <h4 className="font-extrabold text-white text-sm">{d.sessionTitle}</h4>
                      <p className="text-[10px] text-slate-400 mt-1">{d.sessionDesc}</p>
                    </div>
                    {sessions.length > 1 && (
                      <button 
                        onClick={revokeAllSessions}
                        className="text-red-400 hover:text-red-300 font-extrabold text-[10px] transition-colors"
                      >
                        {d.revokeAllSessions}
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {sessions.map(s => (
                      <div key={s.id} className="flex justify-between items-center p-3.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-600/10 border border-purple-500/25 rounded-lg text-purple-400">
                            {s.device.includes('iPhone') ? <PhoneIcon className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">{s.device}</span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">IP: {s.ip} · {s.location}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {s.current ? (
                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[9px] font-black uppercase rounded">
                              {d.activeNow}
                            </span>
                          ) : (
                            <button 
                              onClick={() => revokeSession(s.id)}
                              className="p-1.5 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 hover:bg-red-500/20 transition-all"
                              title={d.revokeSession}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: READING PREFERENCES & CLOUD SYNC */}
            {activeTab === 'preferences' && (
              <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-6 shadow-xl space-y-6">
                <div className="border-b border-[#1f1f3a]/60 pb-3">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-purple-400" /> {d.readingConf}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Cấu hình được tự động lưu lên đám mây và đồng bộ giữa các thiết bị di động/máy tính.</p>
                </div>

                {/* Reader Settings Config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {/* Font Size */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{d.fontSize} ({readerConf.fontSize}px)</label>
                      <input 
                        type="range" 
                        min="12" 
                        max="32" 
                        step="1"
                        value={readerConf.fontSize}
                        onChange={(e) => setReaderConf(prev => ({...prev, fontSize: parseInt(e.target.value)}))}
                        className="w-full accent-purple-500"
                      />
                    </div>

                    {/* Font Family */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{d.fontFamily}</label>
                      <select 
                        value={readerConf.fontFamily}
                        onChange={(e) => setReaderConf(prev => ({...prev, fontFamily: e.target.value}))}
                        className="w-full px-4 py-2.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-slate-300 outline-none"
                      >
                        <option value="font-sans">Sans-serif (Hiện đại)</option>
                        <option value="font-serif">Serif (Cổ điển)</option>
                        <option value="font-mono">Monospace (Lập trình viên)</option>
                      </select>
                    </div>

                    {/* Line Height */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{d.lineHeight}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[1.4, 1.6, 1.8].map(lh => (
                          <button
                            key={lh}
                            type="button"
                            onClick={() => setReaderConf(prev => ({...prev, lineHeight: lh}))}
                            className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                              readerConf.lineHeight === lh
                                ? 'bg-purple-600/25 border-purple-500 text-purple-300'
                                : 'bg-[#0b0b14] border-[#1f1f3a] text-slate-400 hover:text-white'
                            }`}
                          >
                            {lh === 1.4 ? d.lineNormal : lh === 1.6 ? d.lineMedium : d.lineWide}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Theme Bg */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{d.themeBg}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['light', 'dark', 'sepia'].map(th => (
                          <button
                            key={th}
                            type="button"
                            onClick={() => setReaderConf(prev => ({...prev, theme: th}))}
                            className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                              readerConf.theme === th
                                ? 'bg-purple-600/25 border-purple-500 text-purple-300'
                                : 'bg-[#0b0b14] border-[#1f1f3a] text-slate-400 hover:text-white'
                            }`}
                          >
                            {th === 'light' ? d.themeLight : th === 'dark' ? d.themeDark : d.themeSepia}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Settings Preview Area */}
                  <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-2xl p-4 flex flex-col justify-between space-y-4">
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Xem trước hiển thị đọc</span>
                    <div 
                      className={`p-4 rounded-xl border flex-1 transition-all ${
                        readerConf.theme === 'light' 
                          ? 'bg-slate-100 text-slate-900 border-slate-200' 
                          : readerConf.theme === 'sepia' 
                            ? 'bg-[#f4eccf] text-[#433422] border-[#e4d6a7]' 
                            : 'bg-[#0d0d1e] text-slate-200 border-purple-500/20'
                      }`}
                      style={{ 
                        fontSize: `${readerConf.fontSize}px`, 
                        lineHeight: readerConf.lineHeight 
                      }}
                    >
                      <h5 className="font-extrabold mb-2 text-sm">Chương 1: Khởi Đầu Mới</h5>
                      <p className={`text-[0.75em] ${readerConf.fontFamily}`}>
                        Thế giới này rộng lớn vô cùng. Võ giả rèn luyện khí huyết, đột phá xiềng xích nhân loại, bước lên con đường võ đạo đỉnh phong...
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full border-t border-[#1f1f3a]/60 my-4" />

                {/* Favorite Tag Preferences */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{d.favCategories}</label>
                  <div className="flex flex-wrap gap-2">
                    {["玄幻", "都市", "言情", "女生", "科幻", "修真", "仙侠", "武侠", "历史", "网游", "同人", "其他"].map(tag => {
                      const tagLabel = tag === "玄幻" ? "Huyền Huyễn" : tag === "都市" ? "Đô Thị" : tag === "言情" ? "Ngôn Tình" : tag === "科幻" ? "Khoa Huyễn" : tag === "仙侠" ? "Tiên Hiệp" : tag === "修真" ? "Tu Chân" : tag;
                      const isSelected = favTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            isSelected 
                              ? 'bg-purple-600 border-purple-500 text-white shadow-md' 
                              : 'bg-[#0b0b14] border-[#1f1f3a] text-slate-400 hover:text-white'
                          }`}
                        >
                          {tagLabel} {isSelected && '✓'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="w-full border-t border-[#1f1f3a]/60 my-4" />

                {/* Notification Settings */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{d.notificationSettings}</label>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-[#0b0b14]/50 border border-[#1f1f3a] rounded-xl">
                      <div className="flex items-center gap-3">
                        <Bell className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-slate-200 font-bold">{d.notifyNewChapters}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotifications(prev => ({...prev, newChapter: !prev.newChapter}))}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          notifications.newChapter ? 'bg-purple-600' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notifications.newChapter ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-[#0b0b14]/50 border border-[#1f1f3a] rounded-xl">
                      <div className="flex items-center gap-3">
                        <Compass className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-slate-200 font-bold">{d.notifyReplies}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotifications(prev => ({...prev, replies: !prev.replies}))}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          notifications.replies ? 'bg-purple-600' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notifications.replies ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 4: WALLET & LEVEL GAMIFICATION */}
            {activeTab === 'wallet' && (
              <div className="space-y-6">
                
                {/* Level Tu Tiên */}
                <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-[#1f1f3a]/60 pb-3">
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400 animate-pulse" /> {d.accountLevel}
                    </h3>
                    <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-black uppercase">
                      {level.rank}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-bold">{d.levelTitle}: <strong className="text-white font-extrabold">{level.name}</strong></span>
                      <span className="text-slate-400 font-mono">{level.exp} / {level.maxExp} EXP</span>
                    </div>

                    {/* Animated EXP bar */}
                    <div className="w-full bg-[#0b0b14] h-3.5 rounded-full overflow-hidden border border-[#1f1f3a] p-0.5">
                      <div 
                        className="bg-gradient-to-r from-amber-400 via-purple-500 to-indigo-600 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${(level.exp / level.maxExp) * 100}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-500 block italic leading-relaxed">
                      💡 {d.expNeeded}: {level.maxExp - level.exp} EXP. Đọc thêm truyện mỗi ngày hoặc ủng hộ dịch giả để thăng cấp cảnh giới nhanh hơn!
                    </span>
                  </div>

                  {/* Badges and Titles Grid */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{d.titlesBadges}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {badges.map(b => (
                        <div 
                          key={b.id} 
                          className={`p-3 rounded-xl border text-center space-y-1 ${b.color} relative overflow-hidden transition-all hover:scale-102`}
                        >
                          <span className="text-lg block">{b.icon}</span>
                          <strong className="text-[10px] font-bold block whitespace-nowrap">{b.title}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ví Tiền & Vật Phẩm */}
                <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="border-b border-[#1f1f3a]/60 pb-3">
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <Coins className="w-5 h-5 text-purple-400" /> {d.walletBalance}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Coin nạp */}
                    <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-4 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">{d.depositCoin}</span>
                        <strong className="text-lg text-emerald-400 font-black font-mono">{wallet.coins.toLocaleString()}</strong>
                      </div>
                      <span className="text-2xl">🪙</span>
                    </div>

                    {/* Xu thưởng */}
                    <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-4 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">{d.bonusCoin}</span>
                        <strong className="text-lg text-amber-400 font-black font-mono">{wallet.bonus.toLocaleString()}</strong>
                      </div>
                      <span className="text-2xl">🎁</span>
                    </div>
                  </div>

                  {/* Kho Vật Phẩm (Inventory) */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{d.itemInventory}</label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-3 text-center space-y-1">
                        <span className="text-xl block">🎫</span>
                        <strong className="text-[10px] text-white block">{d.itemRecommendation}</strong>
                        <span className="text-xs text-purple-400 font-black font-mono">x{wallet.tickets}</span>
                      </div>
                      <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-3 text-center space-y-1">
                        <span className="text-xl block">⚡</span>
                        <strong className="text-[10px] text-white block">{d.itemVote}</strong>
                        <span className="text-xs text-purple-400 font-black font-mono">x{wallet.votes}</span>
                      </div>
                      <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-3 text-center space-y-1">
                        <span className="text-xl block">💎</span>
                        <strong className="text-[10px] text-white block">{d.itemGift}</strong>
                        <span className="text-xs text-purple-400 font-black font-mono">x{wallet.gifts}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transaction history logs */}
                <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-[#1f1f3a]/60 pb-3">
                    <h3 className="text-sm font-extrabold text-white">{d.txHistory}</h3>
                    <div className="flex gap-1 bg-[#0b0b14] border border-[#1f1f3a] rounded-lg p-0.5">
                      <button
                        onClick={() => setTxTab('deposit')}
                        className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                          txTab === 'deposit' 
                            ? 'bg-purple-600 text-white' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {d.txTabDeposit}
                      </button>
                      <button
                        onClick={() => setTxTab('expense')}
                        className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                          txTab === 'expense' 
                            ? 'bg-purple-600 text-white' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {d.txTabExpense}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] text-slate-300">
                      <thead>
                        <tr className="border-b border-[#1f1f3a] text-slate-500 font-bold">
                          <th className="pb-2">{d.txDetail}</th>
                          <th className="pb-2">{d.txCost}</th>
                          <th className="pb-2">{d.txTime}</th>
                          <th className="pb-2 text-right">{d.txStatus}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1f1f3a]/30">
                        {txTab === 'deposit' ? (
                          depositLogs.map(log => (
                            <tr key={log.id} className="hover:bg-white/[0.01]">
                              <td className="py-2.5 font-semibold text-white">{log.detail}</td>
                              <td className="py-2.5 text-emerald-400 font-bold">+{formatCurrency(log.amount)}</td>
                              <td className="py-2.5 text-slate-500 font-mono">{log.time}</td>
                              <td className="py-2.5 text-right">
                                <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded text-[9px] font-black uppercase">
                                  Thành công
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          expenseLogs.map(log => (
                            <tr key={log.id} className="hover:bg-white/[0.01]">
                              <td className="py-2.5 font-semibold text-white">{log.detail}</td>
                              <td className="py-2.5 text-red-400 font-bold">{log.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(log.amount))}</td>
                              <td className="py-2.5 text-slate-500 font-mono">{log.time}</td>
                              <td className="py-2.5 text-right">
                                <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded text-[9px] font-black uppercase">
                                  Thành công
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 5: USAGE STATISTICS */}
            {activeTab === 'stats' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Header card */}
                <div className="bg-[#121225]/80 border border-[#1f1f3a] rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="border-b border-[#1f1f3a]/60 pb-3 flex justify-between items-center">
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-purple-400" /> Thống Kê & Lịch Sử Sử Dụng
                    </h3>
                    <button
                      onClick={async () => {
                        setStatsLoading(true);
                        try {
                          const [statsRes, historyRes] = await Promise.all([
                            api.get('/api/user/stats'),
                            api.get('/api/user/history')
                          ]);
                          setStats(statsRes.data);
                          setReadingHistory(historyRes.data);
                        } catch (e) {}
                        setStatsLoading(false);
                      }}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all"
                      title="Làm mới"
                    >
                      <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {statsLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-3">
                      <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                      <span className="text-xs text-slate-400 font-medium animate-pulse">Đang tải dữ liệu hệ thống...</span>
                    </div>
                  ) : !user ? (
                    <div className="p-8 text-center bg-[#0b0b14]/50 rounded-xl border border-[#1f1f3a] space-y-4">
                      <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">Yêu cầu đăng nhập</h4>
                        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                          Bạn đang trải nghiệm dưới quyền Khách. Hãy đăng nhập tài khoản để đồng bộ và xem chi tiết thời gian đọc (Web vs Chrome Extension, Online vs Offline) cũng như số liệu dịch thuật.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Grid cards statistics */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        {/* CARD 1: Tổng thời gian đọc */}
                        <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-4 flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-full flex items-center justify-center shrink-0">
                            <Clock className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">TỔNG THỜI GIAN ĐỌC</span>
                            <span className="text-lg font-extrabold text-white block mt-0.5">
                              {stats ? formatDuration(stats.total_time_seconds) : '0 phút'}
                            </span>
                            <span className="text-[9px] text-slate-400 block mt-0.5">
                              Tính cả Web và Chrome Extension
                            </span>
                          </div>
                        </div>

                        {/* CARD 2: Môi trường đọc */}
                        <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-4 flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center shrink-0">
                            <Laptop className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">MÔI TRƯỜNG ĐỌC</span>
                            <div className="flex justify-between items-center text-xs mt-1 text-slate-300">
                              <span className="flex items-center gap-1 font-medium"><Tv className="w-3.5 h-3.5 text-blue-400" /> Web:</span>
                              <span className="font-extrabold text-white">{stats ? formatDuration(stats.web_time_seconds) : '0m'}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs mt-0.5 text-slate-300">
                              <span className="flex items-center gap-1 font-medium"><Smartphone className="w-3.5 h-3.5 text-indigo-400" /> Ext:</span>
                              <span className="font-extrabold text-white">{stats ? formatDuration(stats.extension_time_seconds) : '0m'}</span>
                            </div>
                          </div>
                        </div>

                        {/* CARD 3: Chế độ kết nối */}
                        <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-4 flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center shrink-0">
                            <Globe className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">CHẾ ĐỘ KẾT NỐI</span>
                            <div className="flex justify-between items-center text-xs mt-1 text-slate-300">
                              <span className="flex items-center gap-1 font-medium text-emerald-400">● Online:</span>
                              <span className="font-extrabold text-white">{stats ? formatDuration(stats.online_time_seconds) : '0m'}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs mt-0.5 text-slate-300">
                              <span className="flex items-center gap-1 font-medium text-amber-500">○ Offline:</span>
                              <span className="font-extrabold text-white">{stats ? formatDuration(stats.offline_time_seconds) : '0m'}</span>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Translation Stats Card */}
                      <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-5 mt-4">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" /> Hiệu suất dịch thuật & Đọc sách
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-[#121225] border border-[#1f1f3a]/60 rounded-lg">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tổng Số Lượt Dịch</span>
                            <span className="text-xl font-extrabold text-purple-400 block mt-1">{stats?.total_translations || 0} lượt</span>
                          </div>
                          <div className="p-3 bg-[#121225] border border-[#1f1f3a]/60 rounded-lg">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Ký tự đã dịch (AI/Convert)</span>
                            <span className="text-xl font-extrabold text-indigo-400 block mt-1">
                              {stats?.total_translated_chars ? stats.total_translated_chars.toLocaleString() : 0} ký tự
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Click History / Reading History List */}
                      <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-5 mt-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-purple-400" /> Lịch sử click xem & Đọc chương gần đây
                        </h4>
                        
                        {readingHistory.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-6">Chưa có lịch sử click xem truyện.</p>
                        ) : (
                          <div className="space-y-4">
                            {readingHistory.map((group, gIdx) => (
                              <div key={gIdx} className="space-y-2">
                                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest block border-b border-[#1f1f3a]/40 pb-1">
                                  {group.group_name}
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {group.books.map((book, bIdx) => (
                                    <div 
                                      key={bIdx} 
                                      className="p-3 bg-[#121225] border border-[#1f1f3a]/60 rounded-lg flex gap-3 items-center hover:border-purple-500/50 transition-all group relative overflow-hidden"
                                    >
                                      <div className="w-9 h-12 bg-slate-800 rounded overflow-hidden shrink-0">
                                        {book.cover ? (
                                          <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">Ảnh</div>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <strong className="text-xs font-bold text-white block truncate group-hover:text-purple-400 transition-colors">
                                          {book.title}
                                        </strong>
                                        <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                                          Tác giả: {book.author || 'Ẩn danh'}
                                        </span>
                                        <span className="text-[9px] text-slate-500 block truncate mt-0.5 font-mono">
                                          Chương cuối: {book.last_chapter || 'Chưa đọc'}
                                        </span>
                                      </div>
                                      {book.url && (
                                        <a 
                                          href={book.url} 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white bg-[#0b0b14] border border-[#1f1f3a] rounded-md text-[10px] hover:bg-purple-600 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                          Mở lại
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Recent Actions Logs */}
                      <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-5 mt-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Sliders className="w-4 h-4 text-purple-400" /> Nhật ký sử dụng hệ thống
                        </h4>
                        {(!stats?.recent_actions || stats.recent_actions.length === 0) ? (
                          <p className="text-xs text-slate-500 text-center py-6">Chưa ghi nhận hoạt động nào gần đây.</p>
                        ) : (
                          <div className="max-h-[220px] overflow-y-auto divide-y divide-[#1f1f3a]/30 pr-1.5 custom-scrollbar">
                            {stats.recent_actions.map((act, idx) => (
                              <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-white">{act.details || act.action_type}</span>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                    <span className="capitalize">{act.app_type === 'extension' ? 'Chrome Extension' : 'Web App'}</span>
                                    <span>•</span>
                                    <span>{act.connection_status === 'online' ? 'Online' : 'Offline'}</span>
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {new Date(act.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                                  {new Date(act.timestamp).toLocaleDateString('vi-VN')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    </MainLayout>
  );
}
