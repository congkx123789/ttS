import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Crown, Check, Copy } from 'lucide-react';
import api from '../services/api';

export default function VipModal({ isOpen, onClose }) {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState('plans'); // 'plans', 'payment'
  const [tab, setTab] = useState('vip'); // 'vip', 'topup'
  const [selectedPlan, setSelectedPlan] = useState('month');
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [polling, setPolling] = useState(false);
  const [copyStatus, setCopyStatus] = useState({});

  useEffect(() => {
    if (isOpen) {
      setStep('plans');
      setTab('vip');
      setSelectedPlan('month');
      setPaymentData(null);
      setPolling(false);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer;
    if (polling && paymentData) {
      const checkStatus = async () => {
        try {
          const res = await api.get(`/api/payment/status/${paymentData.order_id}`);
          if (res.data.status === 'completed') {
            setPolling(false);
            alert("Thanh toán thành công! Tài khoản của bạn đã được cập nhật 👑");
            await refreshUser();
            onClose();
          } else if (res.data.status === 'expired') {
            setPolling(false);
            alert("Yêu cầu thanh toán đã hết hạn.");
            setStep('plans');
          }
        } catch (e) {
          console.error(e);
        }
      };
      timer = setInterval(checkStatus, 3000);
    }
    return () => clearInterval(timer);
  }, [polling, paymentData]);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [key]: false }));
      }, 1500);
    });
  };

  const handleInitiatePayment = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/payment/create', { plan: selectedPlan });
      setPaymentData(res.data);
      setStep('payment');
      setPolling(true);
    } catch (e) {
      alert(e.response?.data?.error || 'Không khởi tạo được thanh toán.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmManual = async () => {
    if (!paymentData) return;
    try {
      const res = await api.post('/api/payment/confirm-manual', { 
        order_id: paymentData.order_id,
        admin_key: 'LYVUHA_ADMIN_2026'
      });
      alert(res.data.message || res.data.error || 'Yêu cầu của bạn đang được xử lý.');
      if (res.data.message && res.data.message.includes("thành công")) {
        await refreshUser();
        onClose();
      }
    } catch (e) {
      alert('Lỗi kết nối máy chủ.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full sm:max-w-md bg-gradient-to-b from-[#111122] to-[#17172e] border border-brand-500/35 sm:rounded-2xl rounded-t-3xl p-6 shadow-2xl overflow-y-auto max-h-[92dvh] animate-slide-up sm:animate-fadeIn">
        {/* Drag handle on mobile */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-5">
          <h3 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 inline-flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-400 fill-amber-400" /> DỊCH VỤ PREMIUM & DEVELOPER
          </h3>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            Mở khoá đặc quyền VIP hoặc nạp thêm số dư API cho các tài khoản nhà phát triển / ứng dụng Chrome Extension.
          </p>
        </div>

        {step === 'plans' && (
          <div className="flex bg-[#0b0b14]/90 p-1 rounded-xl border border-white/5 mb-5 text-[11px] font-bold">
            <button 
              onClick={() => { setTab('vip'); setSelectedPlan('month'); }} 
              className={`flex-1 py-2 rounded-lg transition-all ${tab === 'vip' ? 'bg-amber-500 text-[#0b0b14]' : 'text-slate-400 hover:text-white'}`}
            >
              👑 Nâng Cấp VIP
            </button>
            <button 
              onClick={() => { setTab('topup'); setSelectedPlan('topup_50k'); }} 
              className={`flex-1 py-2 rounded-lg transition-all ${tab === 'topup' ? 'bg-amber-500 text-[#0b0b14]' : 'text-slate-400 hover:text-white'}`}
            >
              ⚡ Nạp Số Dư API
            </button>
          </div>
        )}

        {step === 'plans' ? (
          <div className="space-y-4">
            {tab === 'vip' ? (
              <>
                {/* Plan 1 */}
                <div 
                  onClick={() => setSelectedPlan('month')}
                  className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex justify-between items-center ${
                    selectedPlan === 'month' 
                      ? 'bg-brand-500/10 border-amber-400 shadow-md shadow-brand-500/5' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <h4 className="text-white font-bold text-sm">Gói VIP 1 Tháng</h4>
                    <p className="text-slate-500 text-xs mt-1">Dịch AI & Nghe TTS không giới hạn</p>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-400 font-extrabold text-lg">50.000đ</span>
                  </div>
                </div>

                {/* Plan 2 */}
                <div 
                  onClick={() => setSelectedPlan('year')}
                  className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex justify-between items-center ${
                    selectedPlan === 'year' 
                      ? 'bg-brand-500/10 border-amber-400 shadow-md shadow-brand-500/5' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <h4 className="text-white font-bold text-sm flex items-center gap-2">
                      Gói VIP 1 Năm 
                      <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-[#0b0b14] text-[9px] font-extrabold px-2 py-0.5 rounded-md">TIẾT KIỆM 67%</span>
                    </h4>
                    <p className="text-slate-500 text-xs mt-1">Giá ưu đãi tốt nhất, thanh toán một lần</p>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-400 font-extrabold text-lg">200.000đ</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Topup 50k */}
                <div 
                  onClick={() => setSelectedPlan('topup_50k')}
                  className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex justify-between items-center ${
                    selectedPlan === 'topup_50k' 
                      ? 'bg-brand-500/10 border-amber-400 shadow-md shadow-brand-500/5' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <h4 className="text-white font-bold text-sm">Gói Nạp 50.000đ</h4>
                    <p className="text-slate-500 text-xs mt-1">Nạp số dư tài khoản nhà phát triển API</p>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-400 font-extrabold text-lg">50.000đ</span>
                  </div>
                </div>

                {/* Topup 100k */}
                <div 
                  onClick={() => setSelectedPlan('topup_100k')}
                  className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex justify-between items-center ${
                    selectedPlan === 'topup_100k' 
                      ? 'bg-brand-500/10 border-amber-400 shadow-md shadow-brand-500/5' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <h4 className="text-white font-bold text-sm">Gói Nạp 100.000đ</h4>
                    <p className="text-slate-500 text-xs mt-1">Nạp số dư tài khoản nhà phát triển API</p>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-400 font-extrabold text-lg">100.000đ</span>
                  </div>
                </div>

                {/* Topup 200k */}
                <div 
                  onClick={() => setSelectedPlan('topup_200k')}
                  className={`p-4 rounded-2xl cursor-pointer border-2 transition-all flex justify-between items-center ${
                    selectedPlan === 'topup_200k' 
                      ? 'bg-brand-500/10 border-amber-400 shadow-md shadow-brand-500/5' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <h4 className="text-white font-bold text-sm flex items-center gap-2">
                      Gói Nạp 200.000đ 
                    </h4>
                    <p className="text-slate-500 text-xs mt-1">Nạp số dư tài khoản nhà phát triển API</p>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-400 font-extrabold text-lg">200.000đ</span>
                  </div>
                </div>
              </>
            )}

            <button 
              onClick={handleInitiatePayment}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-purple-600 hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all mt-4"
            >
              {loading ? 'Đang tạo mã thanh toán...' : 'Tiến Hành Thanh Toán'}
            </button>
          </div>
        ) : (
          paymentData && (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-2xl border-2 border-amber-400/30 shadow-xl">
                <img src={paymentData.qr_url} alt="QR VietQR" className="w-[190px] h-[190px] rounded-lg" />
              </div>

              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs space-y-3">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-400">Ngân hàng</span>
                  <strong className="text-white">{paymentData.bank_info.bank}</strong>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-400">Số tài khoản</span>
                  <div className="flex items-center gap-2">
                    <strong className="text-white font-mono">{paymentData.bank_info.account_no}</strong>
                    <button 
                      onClick={() => handleCopy(paymentData.bank_info.account_no, 'account')}
                      className="p-1 bg-white/10 hover:bg-white/20 rounded-md text-brand-300 text-[10px] flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> {copyStatus['account'] ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-400">Tên tài khoản</span>
                  <strong className="text-white uppercase">{paymentData.bank_info.account_name}</strong>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-400">Số tiền</span>
                  <strong className="text-amber-400 font-bold text-sm">{paymentData.amount_formatted}</strong>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-slate-400">Nội dung chuyển khoản <span className="text-red-500">*</span></span>
                  <div className="flex gap-2 w-full">
                    <div className="flex-1 bg-black/60 border border-dashed border-amber-400/50 p-2.5 rounded-lg font-mono text-sm text-amber-400 font-bold text-center tracking-wider select-all">
                      {paymentData.order_id}
                    </div>
                    <button 
                      onClick={() => handleCopy(paymentData.order_id, 'content')}
                      className="px-3 bg-brand-500/20 border border-brand-500/40 text-brand-300 font-semibold rounded-lg flex items-center gap-1 hover:bg-brand-500/35 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" /> {copyStatus['content'] ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-cyan-400 text-[11px] animate-pulse">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                <span>Hệ thống đang kiểm tra giao dịch tự động...</span>
              </div>

              <div className="flex gap-2 w-full mt-2">
                <button 
                  onClick={() => { setStep('plans'); setPolling(false); }}
                  className="flex-1 py-3 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Quay lại
                </button>
                <button 
                  onClick={handleConfirmManual}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-105 text-[#0b0b14] font-bold rounded-xl shadow-lg transition-colors text-xs"
                >
                  Đã chuyển khoản
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
