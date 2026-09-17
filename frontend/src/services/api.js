import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'http://localhost:3001/api'});
api.interceptors.request.use(config=>{const token=localStorage.getItem('token');if(token)config.headers.Authorization=`Bearer ${token}`;return config;});
api.interceptors.response.use(r=>r,e=>{if(e.response?.status===401 && !location.pathname.startsWith('/tv')){localStorage.removeItem('token');localStorage.removeItem('user');location.href='/login';}return Promise.reject(e);});
export const errMsg=e=>e.response?.data?.error||e.message||'Erro inesperado';
