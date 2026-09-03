import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return '';
  }
})();

export function resolveAssetUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//.test(url)) return url;
  return `${API_ORIGIN}${url}`;
}

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tilex_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('tilex_refresh_token');

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
          if (res.data.success) {
            localStorage.setItem('tilex_access_token', res.data.data.accessToken);
            if (res.data.data.refreshToken) {
              localStorage.setItem('tilex_refresh_token', res.data.data.refreshToken);
            }
            originalRequest.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          localStorage.removeItem('tilex_access_token');
          localStorage.removeItem('tilex_refresh_token');
          localStorage.removeItem('tilex_user');
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        }
      } else {
        localStorage.removeItem('tilex_access_token');
        localStorage.removeItem('tilex_user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
