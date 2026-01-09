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

// ============================================================================
// TOKEN MANAGEMENT (In-Memory)
// ============================================================================
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// ============================================================================
// AXIOS INTERCEPTORS
// ============================================================================

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Add JWT token from memory to request headers if available
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise(function (resolve, reject) {
        refreshAccessToken()
          .then((newToken) => {
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            processQueue(null, newToken);
            resolve(api(originalRequest));
          })
          .catch((err) => {
            processQueue(err, null);
            setAccessToken(null); // Clear invalid token

            // Only redirect to login if we're not already there
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

// Explicit refresh token function
export const refreshAccessToken = async (): Promise<string> => {
  try {
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
    const newToken = res.data.access_token;
    setAccessToken(newToken);
    return newToken;
  } catch (error) {
    throw error;
  }
};