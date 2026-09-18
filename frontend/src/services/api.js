import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 15000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !location.pathname.startsWith('/tv')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export const errMsg = error => {
  if (!error.response) return 'Servidor indisponível ou conexão interrompida. Os dados já exibidos foram mantidos; tente novamente.';
  return error.response?.data?.error || error.message || 'Erro inesperado';
};
