

import axios from 'axios';
import { clearStoredAuth } from '../contexts/authUtils';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://localhost:44324/api', //'https://localhost:7129/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.toLowerCase().includes('/auth/login');

    // Token hết hạn / không hợp lệ: xóa phiên và về trang đăng nhập,
    // kèm đường dẫn đang xem để đăng nhập xong quay lại đúng chỗ.
    if (error.response?.status === 401 && !isLoginRequest) {
      clearStoredAuth();

      if (window.location.pathname !== '/login') {
        const from = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?reason=expired&from=${from}`);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;