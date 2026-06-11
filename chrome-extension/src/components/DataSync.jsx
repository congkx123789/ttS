import React, { useState, useEffect } from 'react';

export default function DataSync({ onSyncFinished }) {
  const [serverUrl, setServerUrl] = useState('https://tienhiep.lyvuha.com');
  const [inputUrl, setInputUrl] = useState('https://tienhiep.lyvuha.com');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUrlLoaded, setIsUrlLoaded] = useState(false);
  const [authToken, setAuthToken] = useState('');

  // Load serverUrl and user on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['serverUrl', 'settings', 'serverUser', 'serverAuthToken'], (res) => {
        const storedUrl = res.serverUrl || (res.settings && res.settings.apiHost) || 'https://tienhiep.lyvuha.com';
        setServerUrl(storedUrl);
        setInputUrl(storedUrl);
        if (res.serverUser) {
          setUser(res.serverUser);
        }
        if (res.serverAuthToken) {
          setAuthToken(res.serverAuthToken);
        }
        setIsUrlLoaded(true);
      });
    } else {
      const storedUrl = localStorage.getItem('serverUrl') || 'https://tienhiep.lyvuha.com';
      setServerUrl(storedUrl);
      setInputUrl(storedUrl);
      setIsUrlLoaded(true);
    }
  }, []);

  // Check login status on serverUrl changes
  useEffect(() => {
    if (isUrlLoaded) {
      checkAuthStatus();
    }
  }, [serverUrl, isUrlLoaded]);

  const handleSaveAndCheck = () => {
    const formattedUrl = inputUrl.trim().replace(/\/$/, '');
    setServerUrl(formattedUrl);
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ serverUrl: formattedUrl });
      chrome.storage.local.get(['settings'], (storageRes) => {
        const settings = storageRes.settings || {};
        settings.apiHost = formattedUrl;
        chrome.storage.local.set({ settings });
      });
    } else {
      localStorage.setItem('serverUrl', formattedUrl);
      const settings = JSON.parse(localStorage.getItem('settings') || '{}');
      settings.apiHost = formattedUrl;
      localStorage.setItem('settings', JSON.stringify(settings));
    }
  };

  const checkAuthStatus = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let currentToken = authToken;
      if (typeof chrome !== 'undefined' && chrome.storage) {
        currentToken = await new Promise(resolve => {
           chrome.storage.local.get(['serverAuthToken'], res => resolve(res.serverAuthToken));
        });
      }
      const headers = { 'Accept': 'application/json' };
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
      const res = await fetch(`${serverUrl}/api/auth/me`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.logged_in) {
          setUser(data.user);
          // Sync state to extension storage
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ serverUser: data.user, serverUrl });
            chrome.storage.local.get(['settings'], (storageRes) => {
              const settings = storageRes.settings || {};
              let changed = false;
              if (data.user.vip_status === 1) {
                if (settings.membershipType !== 'vip') {
                  settings.membershipType = 'vip';
                  settings.vipKey = settings.vipKey || 'VIP_SERVER';
                  changed = true;
                }
              } else {
                if (settings.membershipType === 'vip' && settings.vipKey === 'VIP_SERVER') {
                  settings.membershipType = 'standard';
                  settings.vipKey = '';
                  changed = true;
                }
              }
              if (changed) {
                chrome.storage.local.set({ settings });
              }
            });
          }
        } else {
          setUser(null);
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.remove(['serverUser']);
          }
        }
      } else {
        setUser(null);
      }
    } catch (e) {
      console.warn("Không kết nối được tới Server:", e);
      setErrorMsg("Không kết nối được tới server. Hãy chắc chắn server đang chạy.");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ tài khoản & mật khẩu.");
      return;
    }
    if (!isLoginMode && !email.trim()) {
      setErrorMsg("Vui lòng nhập Email để khôi phục mật khẩu sau này.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    try {
      const body = isLoginMode 
        ? { username, password } 
        : { username, password, email };
      const res = await fetch(`${serverUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
      });
      const data = await res.json();

      if (res.ok) {
        if (isLoginMode) {
          setSuccessMsg("Đăng nhập thành công!");
          setUser(data.user);
          setUsername('');
          setPassword('');
          setEmail('');
          const newToken = data.access_token || '';
          setAuthToken(newToken);
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ 
              serverUser: data.user, 
              serverUrl,
              serverAuthToken: data.access_token,
              serverRefreshToken: data.refresh_token
            });
            chrome.storage.local.get(['settings'], (storageRes) => {
              const settings = storageRes.settings || {};
              let changed = false;
              if (data.user.vip_status === 1) {
                if (settings.membershipType !== 'vip') {
                  settings.membershipType = 'vip';
                  settings.vipKey = settings.vipKey || 'VIP_SERVER';
                  changed = true;
                }
              } else {
                if (settings.membershipType === 'vip' && settings.vipKey === 'VIP_SERVER') {
                  settings.membershipType = 'standard';
                  settings.vipKey = '';
                  changed = true;
                }
              }
              if (changed) {
                chrome.storage.local.set({ settings });
              }
            });
          }
          if (onSyncFinished) onSyncFinished();
        } else {
          setSuccessMsg("Đăng ký thành công! Đang chuyển sang đăng nhập...");
          setIsLoginMode(true);
          setPassword('');
          setEmail('');
        }
      } else {
        setErrorMsg(data.error || "Có lỗi xảy ra.");
      }
    } catch (err) {
      setErrorMsg("Lỗi kết nối server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      await fetch(`${serverUrl}/api/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });
      setUser(null);
      setAuthToken('');
      setSuccessMsg("Đã đăng xuất.");
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.remove(['serverUser', 'serverAuthToken', 'serverRefreshToken']);
        chrome.storage.local.get(['settings'], (storageRes) => {
          const settings = storageRes.settings || {};
          if (settings.vipKey === 'VIP_SERVER') {
            settings.membershipType = 'standard';
            settings.vipKey = '';
            chrome.storage.local.set({ settings });
          }
        });
      }
    } catch (e) {
      setErrorMsg("Lỗi khi đăng xuất.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 h-full pb-10">
      
      {/* Server Configuration Section */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">dns</span>
            <h2 className="font-semibold text-sm">Cấu hình Máy chủ</h2>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${user ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {user ? 'ONLINE' : 'CHƯA ĐỒNG BỘ'}
          </span>
        </div>
        
        <div className="space-y-2">
          <div>
            <label className="text-[11px] text-on-surface-variant font-medium ml-1">Đường dẫn Server</label>
            <div className="flex gap-2 mt-1">
              <input 
                className="flex-1 h-9 bg-surface-container-low border border-outline-variant rounded-lg px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono" 
                type="text" 
                value={inputUrl} 
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Ví dụ: https://tienhiep.lyvuha.com"
              />
              <button 
                onClick={handleSaveAndCheck}
                className="px-3 h-9 bg-surface-container-high border border-outline-variant rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-all active:scale-95"
                title="Lưu & Kiểm tra kết nối"
              >
                <span className="material-symbols-outlined text-[18px]">sync</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Authentication card */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 relative overflow-hidden">
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2">
            <span className="material-symbols-outlined animate-spin text-primary text-[28px]">sync</span>
            <p className="text-xs text-on-surface-variant">Đang kết nối tới máy chủ...</p>
          </div>
        ) : user ? (
          // Logged In view
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-green-500 text-[24px]">account_circle</span>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">{user.username}</h3>
                  <p className="text-[10px] text-on-surface-variant">
                    Quyền hạn: {user.vip_status === 1 ? <span className="text-yellow-500 font-bold">👑 VIP Member</span> : "Thành viên Thường"}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="px-2.5 py-1.5 border border-error/30 text-error hover:bg-error/10 text-[11px] font-semibold rounded-lg transition-all active:scale-95"
              >
                Đăng xuất
              </button>
            </div>

            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant text-[11px] text-on-surface-variant leading-relaxed">
              🎉 <strong>Trạng thái: Đã liên kết!</strong> Lịch sử đọc truyện và tủ sách của bạn hiện đang được đồng bộ tự động giữa Chrome Extension và Website chính tại <a href={serverUrl} target="_blank" className="text-primary underline font-mono">{serverUrl}</a>.
            </div>

            <button 
              onClick={() => {
                if (onSyncFinished) onSyncFinished();
                alert("Đồng bộ dữ liệu thành công!");
              }}
              className="w-full h-9 bg-primary text-white hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              Đồng bộ dữ liệu ngay
            </button>
          </div>
        ) : (
          // Login / Register Form
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-[20px]">vpn_key</span>
              <h2 className="font-semibold text-sm">{isLoginMode ? "Đăng Nhập Tài Khoản" : "Đăng Ký Tài Khoản"}</h2>
            </div>

            {errorMsg && (
              <div className="bg-error/10 border border-error/20 text-error text-[11px] p-2 rounded-lg font-medium">
                ⚠️ {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-600 text-[11px] p-2 rounded-lg font-medium">
                ✅ {successMsg}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] text-on-surface-variant font-medium ml-1">Tên tài khoản</label>
              <input 
                className="w-full h-8.5 bg-surface-container-low border border-outline-variant rounded-lg px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" 
                type="text" 
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-on-surface-variant font-medium ml-1">Mật khẩu</label>
              <input 
                className="w-full h-8.5 bg-surface-container-low border border-outline-variant rounded-lg px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" 
                type="password" 
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {!isLoginMode && (
              <div className="space-y-1">
                <label className="text-[10px] text-on-surface-variant font-medium ml-1">Email (để khôi phục mật khẩu)</label>
                <input 
                  className="w-full h-8.5 bg-surface-container-low border border-outline-variant rounded-lg px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" 
                  type="email" 
                  placeholder="Nhập email của bạn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full h-9 bg-primary text-white hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                  Đang xử lý...
                </>
              ) : (
                isLoginMode ? "Đăng nhập" : "Tạo tài khoản"
              )}
            </button>

            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-outline-variant"></div>
              <span className="text-[9px] text-outline">hoặc</span>
              <div className="flex-1 h-px bg-outline-variant"></div>
            </div>

            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setIsSubmitting(true);
                
                if (typeof chrome !== 'undefined' && chrome.identity) {
                  chrome.identity.getAuthToken({ interactive: true }, async function(token) {
                    if (chrome.runtime.lastError) {
                      setErrorMsg("Lỗi Google Auth (Chưa cấu hình 'key' trong manifest). Hãy đăng nhập trực tiếp trên trang Web: " + serverUrl);
                      setIsSubmitting(false);
                      // Fallback: Open server URL in a new tab where Web login works
                      setTimeout(() => {
                        window.open(serverUrl, '_blank');
                      }, 2000);
                      return;
                    }
                    
                    try {
                      const res = await fetch(`${serverUrl}/api/auth/google/callback`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ credential: token }),
                        credentials: 'include'
                      });
                      
                      const data = await res.json();
                      if (res.ok) {
                        setSuccessMsg("Đăng nhập Google thành công!");
                        setUser(data.user);
                        
                        chrome.storage.local.set({ 
                          serverUser: data.user, 
                          serverUrl,
                          serverAuthToken: data.access_token,
                          serverRefreshToken: data.refresh_token
                        });
                        chrome.storage.local.get(['settings'], (storageRes) => {
                          const settings = storageRes.settings || {};
                          let changed = false;
                          if (data.user.vip_status === 1) {
                            if (settings.membershipType !== 'vip') {
                              settings.membershipType = 'vip';
                              settings.vipKey = settings.vipKey || 'VIP_SERVER';
                              changed = true;
                            }
                          } else {
                            if (settings.membershipType === 'vip' && settings.vipKey === 'VIP_SERVER') {
                              settings.membershipType = 'standard';
                              settings.vipKey = '';
                              changed = true;
                            }
                          }
                          if (changed) {
                            chrome.storage.local.set({ settings });
                          }
                        });
                        if (onSyncFinished) onSyncFinished();
                      } else {
                        setErrorMsg(data.error || "Có lỗi xảy ra khi xác thực.");
                      }
                    } catch (err) {
                      setErrorMsg("Lỗi kết nối server.");
                    } finally {
                      setIsSubmitting(false);
                    }
                  });
                } else {
                  setErrorMsg("Tính năng này chỉ hoạt động trong Extension Chrome.");
                  setIsSubmitting(false);
                }
              }}
              className="w-full h-9 bg-white border border-outline-variant text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 mb-2 cursor-pointer"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
              Đăng nhập bằng Google
            </button>

            <div className="text-center pt-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
              >
                {isLoginMode ? "Chưa có tài khoản? Đăng ký ngay" : "Đã có tài khoản? Đăng nhập"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
