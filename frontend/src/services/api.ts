import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send cookies with cross-origin requests
});

// Helper to get user provider
let cachedProvider: string | null = null;
export const getUserProvider = async (): Promise<string> => {
  if (cachedProvider !== null) return cachedProvider;
  
  try {
    const { data } = await api.get('/auth/profile');
    cachedProvider = data.provider || 'google';
    return cachedProvider as string;
  } catch (error) {
    console.error('Failed to get user provider:', error);
    return 'google'; // Default to google
  }
};

export const clearProviderCache = () => {
  cachedProvider = null;
};

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Add JWT token from localStorage to request headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise(function (resolve, reject) {
        axios
          .post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
          .then(() => {
            processQueue(null, null);
            resolve(api(originalRequest));
          })
          .catch((err) => {
            processQueue(err, null);
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            reject(err);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    return Promise.reject(error);
  },
);