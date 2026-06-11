import React, { useState, useEffect, useRef } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import api from '../services/api';
import VipModal from '../components/VipModal';
import { 
  Key, Plus, Trash2, Copy, Check, Terminal, Play, 
  Pause, RefreshCw, Send, Book, ShieldAlert, Award
} from 'lucide-react';

export default function Developer() {
  const { user } = useAuth();
  const { t, lang } = useLang();

  const [keys, setKeys] = useState([]);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [newKeyName, setNewKeyName] = useState('');
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  // Usage states
  const [usages, setUsages] = useState([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Sandbox states
  const [sandboxApiKey, setSandboxApiKey] = useState('');
  const [sandboxTtsText, setSandboxTtsText] = useState('武之极，破苍穹，动乾坤！Trong thế giới này, kẻ mạnh làm chủ.');
  const [sandboxTtsSpeed, setSandboxTtsSpeed] = useState(1.0);
  const [playingSandboxAudio, setPlayingSandboxAudio] = useState(false);
  const [loadingSandboxAudio, setLoadingSandboxAudio] = useState(false);
  const sandboxAudioRef = useRef(null);

  const [sandboxTransText, setSandboxTransText] = useState('第1章 开封神殿\n杨开迈步走入神殿。');
  const [sandboxTransMode, setSandboxTransMode] = useState('fast');
  const [sandboxTransResult, setSandboxTransResult] = useState('');
  const [translatingSandbox, setTranslatingSandbox] = useState(false);

  useEffect(() => {
    if (user) {
      fetchKeys();
      fetchUsage();
    }
  }, [user]);

  const fetchKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await api.get('/api/developer/keys');
      setKeys(res.data.keys || []);
      setBalance(res.data.balance || 0);
      if (res.data.keys && res.data.keys.length > 0) {
        setSandboxApiKey(res.data.keys[0].api_key);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingKeys(false);
    }
  };

  const fetchUsage = async () => {
    setLoadingUsage(true);
    try {
      const res = await api.get('/api/developer/usage');
      setUsages(res.data.usage || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      await api.post('/api/developer/keys/create', { name: newKeyName });
      setNewKeyName('');
      fetchKeys();
    } catch (e) {
      alert(t.developer?.createError || "Lỗi khi tạo API Key.");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyString) => {
    if (!window.confirm(t.developer?.revokeConfirm || "Bạn có chắc chắn muốn thu hồi khóa API này? Tất cả các ứng dụng đang sử dụng nó sẽ bị ngắt kết nối.")) return;
    try {
      await api.post('/api/developer/keys/delete', { api_key: keyString });
      fetchKeys();
    } catch (e) {
      alert(t.developer?.revokeError || "Lỗi khi thu hồi API Key.");
    }
  };

  const handleCopy = (txt) => {
    navigator.clipboard.writeText(txt);
    setCopiedKey(txt);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const runTtsSandbox = async () => {
    if (!sandboxApiKey) {
      alert(t.developer?.keyNameRequired || "Vui lòng tạo hoặc chọn một API Key trước.");
      return;
    }
    setLoadingSandboxAudio(true);
    setPlayingSandboxAudio(false);
    if (sandboxAudioRef.current) {
      sandboxAudioRef.current.pause();
      sandboxAudioRef.current = null;
    }

    try {
      // Call endpoint using axios base but overriding headers to simulate a developer client
      const res = await api.post('/v1/audio/speech', {
        input: sandboxTtsText,
        speed: sandboxTtsSpeed
      }, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${sandboxApiKey}`
        }
      });

      const audioUrl = URL.createObjectURL(res.data);
      const audio = new Audio(audioUrl);
      sandboxAudioRef.current = audio;
      audio.playbackRate = sandboxTtsSpeed;
      audio.onplay = () => {
        audio.playbackRate = sandboxTtsSpeed;
      };
      audio.onplaying = () => {
        audio.playbackRate = sandboxTtsSpeed;
      };
      audio.play()
        .then(() => {
          audio.playbackRate = sandboxTtsSpeed;
        })
        .catch(e => console.error("Sandbox playback failed:", e));
      setPlayingSandboxAudio(true);
      audio.onended = () => setPlayingSandboxAudio(false);
    } catch (e) {
      alert(t.reader?.ttsError || "Lỗi phát âm thanh. Vui lòng thử lại sau.");
    } finally {
      setLoadingSandboxAudio(false);
    }
  };

  const runTranslationSandbox = async () => {
    if (!sandboxApiKey) {
      alert(t.developer?.keyNameRequired || "Vui lòng tạo hoặc chọn một API Key trước.");
      return;
    }
    setTranslatingSandbox(true);
    setSandboxTransResult('');
    try {
      const res = await api.post('/api/v1/translate', {
        texts: sandboxTransText.split('\n'),
        mode: sandboxTransMode
      }, {
        headers: {
          'Authorization': `Bearer ${sandboxApiKey}`
        }
      });
      if (res.data && res.data.translations) {
        setSandboxTransResult(res.data.translations.join('\n'));
      }
    } catch (e) {
      alert(t.reader?.errorLoadingChapter || "Lỗi tải nội dung.");
    } finally {
      setTranslatingSandbox(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val);
    if (isNaN(num)) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="py-20 text-center text-slate-500 max-w-md mx-auto space-y-4">
          <Terminal className="w-12 h-12 text-purple-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Developer API Console</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t.loginToViewHistory || "Vui lòng đăng nhập để tiếp tục."}
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Banner header */}
        <div className="bg-[#121225]/60 border border-[#1f1f3a] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              <Terminal className="text-purple-400 w-6 h-6" /> {t.developer?.title || "Developer API & TTS Console"}
            </h2>
            <p className="text-xs text-slate-400">
              {t.developer?.subtitle || "Quản lý API Key, giám sát số dư và kiểm thử dịch thuật/TTS thời gian thực."}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="bg-[#0b0b14]/80 border border-purple-500/25 px-5 py-3 rounded-2xl text-right flex-1 md:flex-initial">
              <span className="text-[9px] text-slate-500 block uppercase font-extrabold tracking-wider">{t.developer?.balance || "Số dư API Developer"}</span>
              <strong className="text-base text-emerald-400 font-extrabold block mt-0.5">{formatCurrency(balance)}</strong>
            </div>
            <button 
              onClick={() => setVipModalOpen(true)}
              className="bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-105 text-[#0b0b14] font-extrabold px-5 py-4 rounded-2xl text-xs transition-all shadow-lg shadow-amber-500/10 whitespace-nowrap active:scale-95"
            >
              ⚡ {lang === 'zh' ? '充值 / 购买 VIP' : lang === 'en' ? 'Deposit / Buy VIP' : 'Nạp số dư / Mua VIP'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Keys list */}
          <div className="lg:col-span-2 space-y-6">
            {/* Keys Table */}
            <div className="bg-[#121225]/60 border border-[#1f1f3a] rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-[#1f1f3a]/50">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-400" /> {t.developer?.apiKeyListTitle || "Danh sách khóa API Key"}
                </h3>
              </div>

              {loadingKeys ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
                  {t.developer?.creating || "Đang tải..."}
                </div>
              ) : keys.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-6">{lang === 'zh' ? '您尚未创建任何 API Key。' : lang === 'en' ? 'You have not created any API Keys yet.' : 'Bạn chưa tạo khóa API nào.'}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-[#1f1f3a] text-slate-500">
                        <th className="pb-2">{t.developer?.keyNameLabel || "Tên khóa"}</th>
                        <th className="pb-2">Khóa API</th>
                        <th className="pb-2">{t.developer?.createdLabel || "Ngày tạo"}</th>
                        <th className="pb-2 text-center">{lang === 'zh' ? '操作' : lang === 'en' ? 'Actions' : 'Hành động'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f1f3a]/30">
                      {keys.map((k, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="py-3 font-semibold text-white">{k.name}</td>
                          <td className="py-3 font-mono text-purple-300">
                            {k.api_key.slice(0, 10)}...{k.api_key.slice(-6)}
                          </td>
                          <td className="py-3 text-slate-500 text-[10px]">
                            {new Date(k.created_at).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button 
                                onClick={() => handleCopy(k.api_key)}
                                className="p-1.5 bg-[#0b0b14] border border-[#1f1f3a] hover:border-purple-500/50 rounded-lg text-slate-400 hover:text-white transition-all"
                                title="Copy API Key"
                              >
                                {copiedKey === k.api_key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              <button 
                                onClick={() => handleRevokeKey(k.api_key)}
                                className="p-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-red-400 transition-all"
                                title="Thu hồi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Create Key Form */}
              <form onSubmit={handleCreateKey} className="flex gap-2 border-t border-[#1f1f3a]/50 pt-4">
                <input 
                  type="text" 
                  placeholder={t.developer?.keyNamePlaceholder || "Tên gợi nhớ"}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-[#0b0b14] border border-[#1f1f3a] rounded-xl text-xs text-white outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={creatingKey || !newKeyName.trim()}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" /> {t.developer?.createBtn || "Tạo khóa"}
                </button>
              </form>
            </div>

            {/* API Sandbox / Playground */}
            <div className="bg-[#121225]/60 border border-[#1f1f3a] rounded-3xl p-6 space-y-6">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-[#1f1f3a]/50 pb-2">
                ⚡ API Sandbox & TTS Playground
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* TTS Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-300">1. Text-to-Speech (TTS)</h4>
                    <span className="text-[9px] bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 uppercase font-bold">RunPod AI</span>
                  </div>

                  <textarea
                    rows={4}
                    value={sandboxTtsText}
                    onChange={(e) => setSandboxTtsText(e.target.value)}
                    placeholder="Nhập văn bản cần phát audio..."
                    className="w-full bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-3 text-xs text-slate-300 outline-none focus:border-purple-500"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold block">{t.reader?.speed || "Tốc độ"} ({sandboxTtsSpeed}x):</label>
                      <input 
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={sandboxTtsSpeed}
                        onChange={(e) => setSandboxTtsSpeed(parseFloat(e.target.value))}
                        className="w-full accent-purple-500 bg-[#0b0b14]"
                      />
                    </div>
                    
                    <div className="space-y-1 flex items-end">
                      <button
                        onClick={runTtsSandbox}
                        disabled={loadingSandboxAudio}
                        className="w-full bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                      >
                        {loadingSandboxAudio ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : playingSandboxAudio ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 fill-current" />
                        )}
                        {playingSandboxAudio ? (lang === 'zh' ? '正在播放...' : lang === 'en' ? 'Playing...' : 'Đang phát...') : (lang === 'zh' ? '播放音频' : lang === 'en' ? 'Play Audio' : 'Gửi & Phát Audio')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Translation Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-300">{lang === 'zh' ? '2. 中越翻译' : lang === 'en' ? '2. Chinese-Vietnamese Translation' : '2. Dịch thuật Trung-Việt'}</h4>
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 uppercase font-bold">Vietphrase</span>
                  </div>

                  <textarea
                    rows={4}
                    value={sandboxTransText}
                    onChange={(e) => setSandboxTransText(e.target.value)}
                    placeholder="Nhập văn bản tiếng Trung cần dịch..."
                    className="w-full bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-3 text-xs text-slate-300 outline-none focus:border-purple-500"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={sandboxTransMode}
                      onChange={(e) => setSandboxTransMode(e.target.value)}
                      className="bg-[#0b0b14] border border-[#1f1f3a] text-xs font-semibold rounded-xl p-2.5 text-slate-300 outline-none cursor-pointer focus:border-purple-500"
                    >
                      <option value="fast">{t.compFast}</option>
                      <option value="vietphrase">{t.compVietphrase}</option>
                    </select>

                    <button
                      onClick={runTranslationSandbox}
                      disabled={translatingSandbox}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                    >
                      {translatingSandbox ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {lang === 'zh' ? '翻译' : lang === 'en' ? 'Translate' : 'Dịch ngay'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Translation Sandbox Results */}
              {sandboxTransResult && (
                <div className="bg-[#0b0b14] border border-[#1f1f3a] rounded-xl p-4 space-y-1.5 animate-in fade-in duration-200">
                  <span className="text-[9px] text-slate-500 block uppercase font-extrabold tracking-wider">{lang === 'zh' ? '翻译结果' : lang === 'en' ? 'Translation Result' : 'Kết quả dịch'}</span>
                  <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">{sandboxTransResult}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: API Docs & Usage logs */}
          <div className="space-y-6">
            {/* Quick API Docs */}
            <div className="bg-[#121225]/60 border border-[#1f1f3a] rounded-3xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-amber-400" /> {t.developer?.apiDocsTitle || "Tài liệu tích hợp (cURL)"}
              </h3>
              
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase">{t.developer?.ttsEndpoint || "1. Chuyển Text thành Audio (OpenAI format)"}</span>
                  <div className="bg-[#0b0b14] border border-white/5 p-3 rounded-xl relative">
                    <pre className="text-[10px] text-slate-300 font-mono overflow-x-auto whitespace-pre leading-relaxed select-all">
{`curl -X POST http://localhost:5051/v1/audio/speech \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"input": "Nhập văn bản cần phát", "speed": 1.0}' \\
  --output audio.wav`}
                    </pre>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase">{t.developer?.transEndpoint || "2. API Dịch Thuật Trung-Việt"}</span>
                  <div className="bg-[#0b0b14] border border-white/5 p-3 rounded-xl relative">
                    <pre className="text-[10px] text-slate-300 font-mono overflow-x-auto whitespace-pre leading-relaxed select-all">
{`curl -X POST http://localhost:5051/api/v1/translate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"texts": ["第1章", "开封神殿"], "mode": "fast"}'`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage logs */}
            <div className="bg-[#121225]/60 border border-[#1f1f3a] rounded-3xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-purple-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-brand-400" /> {t.developer?.apiUsageHistoryTitle || "Nhật ký cuộc gọi gần đây"}
              </h3>

              {loadingUsage ? (
                <div className="text-center py-4 text-slate-500 text-xs">Đang tải...</div>
              ) : usages.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-4">{lang === 'zh' ? '暂无接口调用记录。' : lang === 'en' ? 'No API usage records found.' : 'Chưa có lịch sử cuộc gọi API nào.'}</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {usages.slice(0, 10).map((u, idx) => (
                    <div key={idx} className="border-b border-[#1f1f3a]/30 pb-2.5 last:border-0 last:pb-0 flex justify-between items-center text-[10px]">
                      <div>
                        <span className="text-white font-bold font-mono">{u.model}</span>
                        <span className="text-slate-500 block text-[9px] mt-0.5">
                          {new Date(u.timestamp).toLocaleTimeString('vi-VN')} · {u.tokens} {lang === 'zh' ? '字符' : lang === 'en' ? 'chars' : 'kí tự'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-400 font-bold block">{u.cost === 0 ? (t.developer?.freeCost || 'Miễn phí (VIP)') : formatCurrency(u.cost)}</span>
                        <span className={`px-1 rounded text-[8px] font-bold ${u.status_code === 200 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                          {u.status_code}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <VipModal isOpen={vipModalOpen} onClose={() => { setVipModalOpen(false); fetchKeys(); }} />
    </MainLayout>
  );
}
