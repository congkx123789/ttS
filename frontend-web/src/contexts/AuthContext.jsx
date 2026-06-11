import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOrCreateApiKey = async () => {
    try {
      const res = await api.get('/api/developer/keys');
      if (res.data && res.data.keys && res.data.keys.length > 0) {
        const key = res.data.keys[0].api_key;
        localStorage.setItem('local_tts_key', key);
        return key;
      } else {
        // No keys, create one!
        const createRes = await api.post('/api/developer/keys/create', { name: 'Auto Matcha Key' });
        if (createRes.data && createRes.data.api_key) {
          const key = createRes.data.api_key;
          localStorage.setItem('local_tts_key', key);
          return key;
        }
      }
    } catch (e) {
      console.error("Failed to fetch/create API key:", e);
    }
    return null;
  };

  const onAuthSuccess = async (accessToken, refreshToken, user) => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
      document.cookie = `accessToken=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
    }
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    }
    
    // Fetch or create API key
    await fetchOrCreateApiKey();
    
    // Notify same-tab listeners (e.g. extension content script)
    window.dispatchEvent(new Event('sync-auth-event'));
  };

  const onAuthFailure = () => {
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('local_tts_key');
    document.cookie = "accessToken=; path=/; max-age=0; SameSite=Lax";
    
    // Notify same-tab listeners
    window.dispatchEvent(new Event('sync-auth-event'));
  };

  const tryRefreshToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      onAuthFailure();
      return;
    }
    try {
      const response = await api.post('/api/auth/refresh', { refresh_token: refreshToken });
      if (response.data && response.data.access_token) {
        await onAuthSuccess(
          response.data.access_token,
          response.data.refresh_token || refreshToken,
          response.data.user
        );
      } else {
        onAuthFailure();
      }
    } catch (e) {
      console.error("Token refresh failed:", e);
      onAuthFailure();
    }
  };

  const checkAuth = async () => {
    try {
      let token = localStorage.getItem('accessToken');
      if (!token) {
        // Fallback to cookie
        const match = document.cookie.match(new RegExp('(^| )accessToken=([^;]+)'));
        if (match) {
          token = match[2];
          localStorage.setItem('accessToken', token);
        }
      }

      if (!token) {
        // No access token, try refresh immediately if possible
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          await tryRefreshToken();
        } else {
          onAuthFailure();
        }
        setLoading(false);
        return;
      }

      const response = await api.get('/api/auth/me');
      if (response.data && response.data.logged_in) {
        await onAuthSuccess(
          token,
          localStorage.getItem('refreshToken'),
          response.data.user
        );
      } else {
        await tryRefreshToken();
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      await tryRefreshToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username, password) => {
    const response = await api.post('/api/auth/login', { username, password });
    if (response.data && response.data.access_token) {
      await onAuthSuccess(
        response.data.access_token,
        response.data.refresh_token,
        response.data.user
      );
      return response.data.user;
    }
    throw new Error(response.data.error || 'Đăng nhập không thành công');
  };

  const register = async (username, password, email) => {
    const response = await api.post('/api/auth/register', { username, password, email });
    if (response.data && response.data.error) {
      throw new Error(response.data.error);
    }
    return response.data;
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/api/auth/logout', { refresh_token: refreshToken });
    } catch (e) {
      console.error(e);
    } finally {
      onAuthFailure();
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      if (response.data && response.data.logged_in) {
        await onAuthSuccess(
          localStorage.getItem('accessToken'),
          localStorage.getItem('refreshToken'),
          response.data.user
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
