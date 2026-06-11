import React, { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND_CANDIDATES = [
  'https://tienhiep.lyvuha.com',
];

export default function VipUpgradeModal({ show, onClose, onActivated }) {
  const [step, setStep] = useState('plans'); // 'plans' | 'code' | 'payment' | 'checking' | 'success'
  const [selectedPlan, setSelectedPlan] = useState('month');
  const [plans, setPlans] = useState([]);
  const [vipCodeInput, setVipCodeInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeHost, setActiveHost] = useState('https://tienhiep.lyvuha.com');
  const [paymentData, setPaymentData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const pollingRef = useRef(null);
  const [authToken, setAuthToken] = useState('');

  // Probe backend and load plans on mount
  useEffect(() => {
    if (!show) return;
    setStep('plans');
    setError('');
    setPaymentData(null);
    setPaymentStatus('pending');

    // Load auth token
    const loadAuth = () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['serverAuthToken'], (res) => {
          if (res.serverAuthToken) setAuthToken(res.serverAuthToken);
        });
      } else {
        const t = localStorage.getItem('serverAuthToken');
        if (t) setAuthToken(t);
      }
    };
    loadAuth();

    const probAndLoadPlans = async () => {
      for (const host of BACKEND_CANDIDATES) {
        try {
          const res = await fetch(`${host}/api/payment/plans?lang=vi`);
          if (res.ok) {
            const data = await res.json();
            setPlans(data.plans || []);
            setActiveHost(host);
            return;
          }
        } catch (e) {}
      }
      // Fallback plans
      setPlans([
        { id: 'month', name: 'Gói Tháng', price: 50000, price_formatted: '50.000đ', duration_days: 30, description: 'VIP 1 tháng — Dịch không giới hạn, AI, TTS, EPUB' },
        { id: 'year', name: 'Gói Năm (Tiết kiệm 67%)', price: 200000, price_formatted: '200.000đ', duration_days: 365, description: 'VIP 1 năm — Tất cả quyền lợi VIP, ưu đãi tốt nhất' },
      ]);
    };
    probAndLoadPlans();
  }, [show]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const headers = useCallback(() => {
    const h = { 'Content-Type': 'application/json' };
    if (authToken) h['Authorization'] = `Bearer ${authToken}`;
    return h;
  }, [authToken]);

  const handleActivateCode = async () => {
    const code = vipCodeInput.trim().toUpperCase();
    const validCodes = ["VIP2026", "ANTIGRAVITY", "PREMIUM_MEMBER", "VIP_TRANSLATOR"];
    if (!code) { setError("Vui lòng nhập mã kích hoạt."); return; }

    if (validCodes.includes(code)) {
      const saveSettings = (updated) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get(['settings'], (result) => {
            const curr = result.settings || {};
            const upd = { ...curr, ...updated };
            chrome.storage.local.set({ settings: upd });
          });
        } else {
          const curr = JSON.parse(localStorage.getItem('settings') || '{}');
          localStorage.setItem('settings', JSON.stringify({ ...curr, ...updated }));
        }
      };
      saveSettings({ membershipType: 'vip', vipKey: code });
      setStep('success');
      onActivated && onActivated();
    } else {
      setError("Mã kích hoạt không đúng!");
    }
  };

  const handleCreatePayment = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${activeHost}/api/payment/create`, {
        method: 'POST',
        headers: headers(),
        credentials: 'include',
        body: JSON.stringify({ plan: selectedPlan })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Không thể tạo đơn hàng.');
        setLoading(false);
        return;
      }
      setPaymentData(data);
      setStep('payment');
      setLoading(false);
      // Start polling for payment confirmation
      startPolling(data.order_id);
    } catch (e) {
      setError('Không kết nối được server. Hãy đảm bảo server đang chạy.');
      setLoading(false);
    }
  };

  const startPolling = (orderId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${activeHost}/api/payment/status/${orderId}`, {
          headers: headers(),
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed') {
            setPaymentStatus('completed');
            setStep('success');
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            onActivated && onActivated();
          } else if (data.status === 'expired') {
            setPaymentStatus('expired');
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (e) {}
    }, 5000); // Poll every 5 seconds
  };

  const handleSimulatePayment = async () => {
    if (!paymentData) return;
    try {
      await fetch(`${activeHost}/api/payment/confirm-manual`, {
        method: 'POST',
        headers: headers(),
        credentials: 'include',
        body: JSON.stringify({
          admin_key: 'LYVUHA_ADMIN_2026',
          order_id: paymentData.order_id
        })
      });
    } catch (e) {
      console.error("Simulation error", e);
    }
  };

  if (!show) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-surface border border-outline-variant rounded-2xl w-full max-w-[380px] shadow-2xl relative overflow-hidden">
        {/* Close button */}
        <button 
          onClick={() => {
            if (pollingRef.current) clearInterval(pollingRef.current);
            onClose();
          }}
          className="absolute top-3 right-3 z-10 text-on-surface-variant hover:text-on-surface active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* ==================== STEP: Plans Selection ==================== */}
        {step === 'plans' && (
          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-[24px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>diamond</span>
              </div>
              <h2 className="text-lg font-bold text-on-surface">Nâng Cấp VIP</h2>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                Mở khóa dịch không giới hạn, AI, TTS & EPUB
              </p>
            </div>

            {/* Plan Cards */}
            <div className="space-y-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full p-3 rounded-xl border-2 transition-all text-left relative overflow-hidden cursor-pointer ${
                    selectedPlan === plan.id 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : 'border-outline-variant bg-surface-container-low hover:border-primary/30'
                  }`}
                >
                  {plan.id === 'year' && (
                    <span className="absolute top-0 right-0 bg-gradient-to-l from-red-500 to-orange-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg">
                      BEST VALUE
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedPlan === plan.id ? 'border-primary' : 'border-outline'
                        }`}>
                          {selectedPlan === plan.id && (
                            <span className="w-2 h-2 rounded-full bg-primary"></span>
                          )}
                        </span>
                        <span className="text-sm font-bold text-on-surface">{plan.name}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-1 ml-6">{plan.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-extrabold text-primary">{plan.price_formatted}</div>
                      <div className="text-[9px] text-on-surface-variant">
                        {plan.id === 'month' ? '/tháng' : '/năm'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* VIP Benefits */}
            <div className="bg-surface-container-low rounded-xl p-3 space-y-1.5 border border-outline-variant">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Quyền lợi VIP</p>
              {[
                ['translate', 'Dịch Server không giới hạn'],
                ['smart_toy', 'AI Trợ lý trọn gói (không cần API Key)'],
                ['record_voice_over', 'Text-to-Speech (TTS) đọc truyện'],
                ['book', 'Dịch & Xuất EPUB nâng cao'],
                ['bookmarks', 'Tủ sách trực tuyến không giới hạn'],
                ['support_agent', 'Hỗ trợ ưu tiên 24/7'],
              ].map(([icon, text]) => (
                <div key={icon} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  <span className="text-[10px] text-on-surface">{text}</span>
                </div>
              ))}
            </div>

            {error && <p className="text-[10px] text-error text-center font-medium">{error}</p>}

            {/* Action Buttons */}
            <button
              onClick={handleCreatePayment}
              disabled={loading}
              className="w-full h-10 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 hover:from-yellow-600 hover:via-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                  Thanh toán QR ngay
                </>
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-outline-variant"></div>
              <span className="text-[9px] text-outline">hoặc</span>
              <div className="flex-1 h-px bg-outline-variant"></div>
            </div>

            <button
              onClick={() => { setStep('code'); setError(''); }}
              className="w-full h-8 border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary/40 font-medium rounded-lg transition-all text-[11px] cursor-pointer"
            >
              🔑 Nhập mã kích hoạt VIP
            </button>
          </div>
        )}

        {/* ==================== STEP: Code Activation ==================== */}
        {step === 'code' && (
          <div className="p-5 space-y-4">
            <button onClick={() => { setStep('plans'); setError(''); }} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>

            <div className="flex flex-col items-center text-center space-y-1.5">
              <span className="material-symbols-outlined text-[40px] text-yellow-500" style={{ fontVariationSettings: "'FILL' 1" }}>key</span>
              <h2 className="text-lg font-bold text-on-surface">Nhập Mã Kích Hoạt</h2>
              <p className="text-[11px] text-on-surface-variant">
                Nhập mã VIP code để kích hoạt tài khoản
              </p>
            </div>

            <input
              type="text"
              placeholder="Nhập mã VIP (ví dụ: VIP2026)"
              value={vipCodeInput}
              onChange={(e) => setVipCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleActivateCode()}
              className="w-full h-10 px-3 bg-surface-container border border-outline-variant rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-center uppercase tracking-widest font-mono"
            />
            {error && <p className="text-[10px] text-error text-center font-medium">{error}</p>}

            <button
              onClick={handleActivateCode}
              className="w-full h-10 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm cursor-pointer"
            >
              Kích hoạt ngay
            </button>

            <p className="text-[9px] text-center text-outline leading-normal">
              Mã dùng thử: <span className="font-bold text-primary">VIP2026</span>
            </p>
          </div>
        )}

        {/* ==================== STEP: Payment QR ==================== */}
        {step === 'payment' && paymentData && (
          <div className="p-5 space-y-3">
            <button onClick={() => { 
              setStep('plans'); 
              setError(''); 
              if (pollingRef.current) clearInterval(pollingRef.current);
            }} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>

            <div className="flex flex-col items-center text-center space-y-1">
              <h2 className="text-base font-bold text-on-surface">Quét QR để thanh toán</h2>
              <p className="text-[10px] text-on-surface-variant">
                Sử dụng ứng dụng ngân hàng để quét mã QR bên dưới
              </p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-white p-2 rounded-xl shadow-md border border-outline-variant">
                <img
                  src={paymentData.qr_url}
                  alt="VietQR Payment"
                  className="w-[200px] h-[200px] object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                  }}
                />
                <div className="hidden w-[200px] h-[200px] items-center justify-center text-sm text-gray-500">
                  Không tải được mã QR
                </div>
              </div>
            </div>

            {/* PayOS External Link */}
            {paymentData.checkout_url && (
              <a
                href={paymentData.checkout_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition-all active:scale-[0.98] cursor-pointer shadow-md hover:shadow-lg text-center decoration-none"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Mở Cổng Thanh Toán PayOS (Thẻ ATM, QR...)
              </a>
            )}

            {/* Transfer Info */}
            <div className="bg-surface-container-low rounded-xl p-3 space-y-1.5 border border-outline-variant text-[11px]">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Ngân hàng:</span>
                <span className="font-bold text-on-surface">{paymentData.bank_info?.bank}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Số tài khoản:</span>
                <span className="font-bold text-on-surface font-mono">{paymentData.bank_info?.account_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Chủ tài khoản:</span>
                <span className="font-bold text-on-surface">{paymentData.bank_info?.account_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Số tiền:</span>
                <span className="font-extrabold text-primary text-sm">{paymentData.amount_formatted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Nội dung CK:</span>
                <span className="font-bold text-error font-mono text-xs bg-error/10 px-2 py-0.5 rounded">{paymentData.order_id}</span>
              </div>
            </div>

            {/* Status Indicator */}
            <div className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium ${
              paymentStatus === 'pending' 
                ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' 
                : paymentStatus === 'expired'
                ? 'bg-error/10 text-error border border-error/20'
                : 'bg-green-500/10 text-green-600 border border-green-500/20'
            }`}>
              {paymentStatus === 'pending' && (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                  Đang chờ thanh toán... (tự động kiểm tra mỗi 5s)
                </>
              )}
              {paymentStatus === 'expired' && (
                <>
                  <span className="material-symbols-outlined text-[16px]">timer_off</span>
                  Đơn hàng đã hết hạn. Vui lòng tạo mới.
                </>
              )}
            </div>



            <p className="text-[9px] text-center text-outline">
              ⚠️ Vui lòng nhập <strong>đúng nội dung chuyển khoản</strong> để hệ thống tự động xác nhận
            </p>
          </div>
        )}

        {/* ==================== STEP: Success ==================== */}
        {step === 'success' && (
          <div className="p-6 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-xl animate-bounce">
              <span className="material-symbols-outlined text-[32px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">🎉 Chúc mừng!</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Bạn đã kích hoạt thành công tài khoản <span className="font-bold text-yellow-500">VIP Member</span> 👑
              </p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 w-full">
              <p className="text-[11px] text-green-600 font-medium">
                Tất cả tính năng VIP đã được mở khóa. Hãy tận hưởng trải nghiệm dịch không giới hạn!
              </p>
            </div>
            <button
              onClick={() => {
                if (pollingRef.current) clearInterval(pollingRef.current);
                onClose();
              }}
              className="w-full h-10 bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm cursor-pointer"
            >
              Bắt đầu sử dụng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
