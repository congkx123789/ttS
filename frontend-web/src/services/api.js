import axios from 'axios';

// =====================================================
// MULTI-SERVER CONFIG
// Thêm bất kỳ server nào vào đây theo thứ tự ưu tiên
// Frontend sẽ tự động chọn server nhanh nhất còn sống
// =====================================================
const SERVERS = import.meta.env.PROD ? [
  'https://tienhiep.lyvuha.com',
  'https://cong123779-tienhiep-backend.hf.space'
] : [''];  // Dev: rỗng → vite proxy

const HEALTH_TIMEOUT = 3000;   // 3s timeout để ping health check
const CACHE_DURATION = 30000;  // Cache server tốt trong 30s

let cachedServer = null;
let cacheExpiry = 0;

// Ping một server, trả về true nếu còn sống
async function pingServer(url) {
  if (!url) return true; // dev mode
  try {
    const res = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Tìm server tốt nhất (race giữa các server)
async function getBestServer() {
  if (Date.now() < cacheExpiry && cachedServer !== null) {
    return cachedServer;
  }

  // Prioritize current window origin immediately because the Flask app serves the static frontend and the database together.
  // This prevents database split-brain issues between local testing and production servers.
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isActualApiServer = currentOrigin && (
    currentOrigin.includes('localhost') || 
    currentOrigin.includes('127.0.0.1') || 
    currentOrigin.includes('hf.space') || 
    currentOrigin.includes('lyvuha.com')
  );
  if (isActualApiServer) {
    cachedServer = currentOrigin;
    cacheExpiry = Date.now() + CACHE_DURATION;
    console.log(`[API] Using matching current origin immediately: ${currentOrigin}`);
    return cachedServer;
  }

  if (SERVERS.length === 1) {
    cachedServer = SERVERS[0];
    cacheExpiry = Date.now() + CACHE_DURATION;
    return cachedServer;
  }

  // Race: server nào phản hồi nhanh nhất và alive → dùng cái đó
  try {
    const winner = await Promise.any(
      SERVERS.map(url =>
        pingServer(url).then(ok => {
          if (ok) return url;
          throw new Error('dead');
        })
      )
    );
    cachedServer = winner;
    cacheExpiry = Date.now() + CACHE_DURATION;
    console.log(`[API] Using server: ${winner}`);
    return winner;
  } catch {
    // Tất cả dead → dùng cái đầu tiên (sẽ báo lỗi ở UI)
    cachedServer = SERVERS[0];
    cacheExpiry = Date.now() + 5000; // retry sau 5s
    return cachedServer;
  }
}

// Tạo axios instance động theo server đang dùng
const api = axios.create({
  headers: { 'Content-Type': 'application/json' }
});

// Interceptor: gắn baseURL động + JWT token
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('accessToken');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Gắn baseURL của server tốt nhất
  if (!config.baseURL) {
    const server = await getBestServer();
    config.baseURL = server;
  }
  return config;
}, (error) => Promise.reject(error));

// Interceptor response: nếu server lỗi → xóa cache → retry lần sau sẽ dùng server khác
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
      cachedServer = null;
      cacheExpiry = 0; // reset cache để lần sau thử lại
    }

    // Nếu lỗi 401 (Unauthorized) và chưa thử refresh
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url && !originalRequest.url.includes('/api/auth/refresh')) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const server = await getBestServer();
          // Gọi trực tiếp axios tránh vòng lặp interceptor
          const refreshRes = await axios.post(`${server}/api/auth/refresh`, {
            refresh_token: refreshToken
          });
          if (refreshRes.data && refreshRes.data.access_token) {
            const newToken = refreshRes.data.access_token;
            localStorage.setItem('accessToken', newToken);
            document.cookie = `accessToken=${newToken}; path=/; max-age=604800; SameSite=Lax`;
            
            // Cập nhật token trong headers và thử lại request gốc
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axios(originalRequest);
          }
        } catch (refreshErr) {
          console.error("Axios interceptor token refresh failed:", refreshErr);
          // Xóa tokens nếu refresh token không còn hợp lệ
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          document.cookie = "accessToken=; path=/; max-age=0; SameSite=Lax";
        }
      }
    }
    return Promise.reject(error);
  }
);

export { getBestServer, SERVERS };
export default api;
