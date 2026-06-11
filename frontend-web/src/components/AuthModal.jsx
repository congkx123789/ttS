import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LangContext';
import { X, Mail, Lock, User, KeyRound } from 'lucide-react';
import api from '../services/api';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const { t } = useLang();
  
  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot', 'reset'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode('login');
      setUsername('');
      setPassword('');
      setEmail('');
      setOtp('');
      setError('');
      setMessage('');
      
      // Initialize Google sign in button if available
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: "107953505478-0gielhlbbif11eu77rb29sq7ie7dqbmn.apps.googleusercontent.com",
          callback: handleGoogleSignInCallback
        });
        window.google.accounts.id.renderButton(
          document.getElementById("google-signin-btn"),
          { theme: "filled_blue", size: "large", width: 290 }
        );
      }
    }
  }, [isOpen]);

  const handleGoogleSignInCallback = async (response) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/google/callback', { credential: response.credential });
      if (res.data && res.data.access_token) {
        localStorage.setItem('accessToken', res.data.access_token);
        document.cookie = `accessToken=${res.data.access_token}; path=/; max-age=604800; SameSite=Lax`;
        localStorage.setItem('user', JSON.stringify(res.data.user));
        
        if (res.data.user?.require_password_change === 1) {
          window.location.href = '/settings';
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi đăng nhập Google');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/resend-verification', { email });
      setMessage(res.data.message || 'Mã xác minh mới đã được gửi.');
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi gửi lại mã xác minh.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!username || !password) {
          setError(t.authRequired);
          setLoading(false);
          return;
        }
        const user = await login(username, password);
        onClose();
        if (user && user.require_password_change === 1) {
          window.location.href = '/settings';
        }
      } else if (mode === 'register') {
        if (!username || !password || !email) {
          setError(t.authRequired);
          setLoading(false);
          return;
        }
        const res = await register(username, password, email);
        if (res.require_verification) {
          setMessage(res.message || 'Một mã xác minh đã được gửi đến email của bạn.');
          setMode('verify_reg');
        } else {
          setMessage(t.regSuccess);
          setMode('login');
          setPassword('');
        }
      } else if (mode === 'verify_reg') {
        if (!email || !otp) {
          setError("Vui lòng nhập đầy đủ email và mã OTP xác minh.");
          setLoading(false);
          return;
        }
        const res = await api.post('/api/auth/verify-registration', { email, otp });
        setMessage(res.data.message || 'Xác minh thành công! Vui lòng đăng nhập.');
        setMode('login');
        setPassword('');
        setOtp('');
      } else if (mode === 'forgot') {
        if (!email) {
          setError("Vui lòng nhập email.");
          setLoading(false);
          return;
        }
        const res = await api.post('/api/auth/forgot-password', { email });
        setMessage(res.data.message || 'Mã OTP đã được gửi đến email của bạn.');
        setMode('reset');
      } else if (mode === 'reset') {
        if (!email || !otp || !password) {
          setError("Vui lòng điền đầy đủ thông tin.");
          setLoading(false);
          return;
        }
        const res = await api.post('/api/auth/reset-password', { email, otp, password });
        setMessage(res.data.message || 'Khôi phục mật khẩu thành công.');
        setMode('login');
        setPassword('');
      }
    } catch (err) {
      const respData = err.response?.data;
      if (respData?.require_verification) {
        setEmail(respData.email || email);
        setMode('verify_reg');
        setError(respData.error || 'Tài khoản chưa được xác minh. Vui lòng nhập mã OTP.');
      } else {
        setError(respData?.error || err.message || t.connError);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full sm:max-w-md bg-[#131324] border border-[#2d2d6b] sm:rounded-2xl rounded-t-3xl p-6 shadow-2xl overflow-hidden animate-slide-up sm:animate-fadeIn max-h-[92dvh] overflow-y-auto">
        {/* Drag handle on mobile */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>

        <h3 className="text-xl font-bold text-white mb-6">
          {mode === 'login' && t.auth?.loginTitle}
          {mode === 'register' && t.auth?.registerTitle}
          {mode === 'verify_reg' && t.auth?.verifyRegTitle}
          {mode === 'forgot' && t.auth?.forgotTitle}
          {mode === 'reset' && t.auth?.resetTitle}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {(mode === 'login' || mode === 'register') && (
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="text" 
                placeholder={t.auth?.usernamePlaceholder}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[#1e1e3a] border border-[#2d2d6b] rounded-xl text-white outline-none focus:border-brand-500 transition-colors"
                required
              />
            </div>
          )}

          {(mode === 'register' || mode === 'forgot' || mode === 'reset' || mode === 'verify_reg') && (
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="email" 
                placeholder={t.auth?.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[#1e1e3a] border border-[#2d2d6b] rounded-xl text-white outline-none focus:border-brand-500 transition-colors"
                required
                disabled={mode === 'verify_reg'}
              />
            </div>
          )}

          {(mode === 'reset' || mode === 'verify_reg') && (
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="text" 
                placeholder={t.auth?.otpPlaceholder}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[#1e1e3a] border border-[#2d2d6b] rounded-xl text-white outline-none focus:border-brand-500 transition-colors"
                required
              />
            </div>
          )}

          {(mode !== 'forgot' && mode !== 'verify_reg') && (
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                placeholder={mode === 'reset' ? t.auth?.newPasswordPlaceholder : t.auth?.passwordPlaceholder} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[#1e1e3a] border border-[#2d2d6b] rounded-xl text-white outline-none focus:border-brand-500 transition-colors"
                required
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-brand-500 to-purple-600 hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all"
          >
            {loading ? t.auth?.processing : (
              mode === 'login' ? t.auth?.submitLogin :
              mode === 'register' ? t.auth?.submitRegister :
              mode === 'forgot' ? t.auth?.submitForgot :
              mode === 'verify_reg' ? t.auth?.submitVerifyReg : t.auth?.submitReset
            )}
          </button>
        </form>

        {mode === 'verify_reg' && (
          <div className="mt-3 text-center">
            <button 
              onClick={handleResendVerification}
              disabled={loading}
              className="text-xs text-brand-400 font-bold hover:underline"
            >
              {t.auth?.resendOtpBtn}
            </button>
          </div>
        )}

        {mode === 'login' && (
          <div className="mt-4 flex justify-center">
            <div id="google-signin-btn"></div>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-slate-400 space-y-2">
          {mode === 'login' && (
            <>
              <div>
                {t.auth?.noAccount}{' '}
                <button onClick={() => setMode('register')} className="text-brand-400 font-semibold hover:underline">
                  {t.auth?.registerNow}
                </button>
              </div>
              <div>
                <button onClick={() => setMode('forgot')} className="text-slate-500 text-xs hover:underline">
                  {t.auth?.forgotPassLink}
                </button>
              </div>
            </>
          )}

          {mode === 'register' && (
            <div>
              {t.auth?.haveAccount}{' '}
              <button onClick={() => setMode('login')} className="text-brand-400 font-semibold hover:underline">
                {t.auth?.submitLogin}
              </button>
            </div>
          )}

          {(mode === 'forgot' || mode === 'reset' || mode === 'verify_reg') && (
            <div>
              <button onClick={() => setMode('login')} className="text-brand-400 font-semibold hover:underline">
                {t.auth?.backToLogin}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
