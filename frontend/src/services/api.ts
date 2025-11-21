import axios from 'axios';
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  removeTokens,
} from './token';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // If the error is 401 (Unauthorized) and it's not a retry attempt
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark as retry attempt
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          // No refresh token available, redirect to login
          removeTokens();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }

        // Attempt to refresh the token
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          },
        );
        const { access_token } = response.data;
        setAccessToken(access_token); // Store new access token
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`; // Update default header
        return api(originalRequest); // Retry original request with new token
      } catch (refreshError) {
        // Refresh token failed or expired
        console.error('Token refresh failed', refreshError);
        removeTokens(); // Clear all tokens
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'; // Redirect to login if not already there
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);
