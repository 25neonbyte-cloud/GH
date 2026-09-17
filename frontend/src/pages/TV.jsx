import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Status } from '../components/Common';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function TV() {
  const [token, setToken] = useState(sessionStorage.getItem('tv_token') || '');
  const [pass, setPass] = useState('');
  const [beds, setBeds] = useState([]);
  const [error, setError] = useState('');

  const login = async e => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${base}/auth/tv`, { password:pass });
      sessionStorage.setItem('tv_token', data.token);
      setToken(data.token);
      setError('');
    } catch { setError('Senha inválida'); }
  };

  const load = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${base}/tv/leitos`, { headers:{Authorization:`Bearer ${token}`} });
      setBeds(Array.isArray(data?.data) ? data.data : []);
      setError('');
    } catch {
      setError('Sessão expirada');
      sessionStorage.removeItem('tv_token');
      setToken('');
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [token]);

  const stats = useMemo(() => ({
    total:beds.length,
    livres:beds.filter(b => b.status === 'LIVRE').length,
    ocupados:beds.filter(b => b.status === 'OCUPADO').length,
    indisponiveis:beds.filter(b => ['BLOQUEADO','MANUTENCAO','RESERVADO'].includes(b.status)).length,
  }), [beds]);

  if (!token) return <div className="min-h-screen grid place-items-center bg-slate-900 text-white"><form onSubmit={login} className="w-80"><h1 className="text-2xl font-bold mb-1">Modo TV</h1><p className="text-slate-400 text-sm mb-4">Mapa operacional sem dados clínicos de pacientes</p><input type="password" className="input text-slate-900" placeholder="Senha" value={pass} onChange={e => setPass(e.target.value)}/>{error && <p className="text-red-300 mt-2">{error}</p>}<button className="btn btn-primary w-full mt-3">Acessar</button></form></div>;

  return <div className="min-h-screen bg-slate-950 text-white p-5 md:p-6">
    <div className="flex flex-col xl:flex-row xl:justify-between xl:items-end gap-4 mb-5">
      <div><h1 className="text-3xl font-bold">Mapa de Leitos</h1><p className="text-slate-400">Atualização automática a cada 30 segundos</p></div>
      <div className="grid grid-cols-4 gap-2 text-center"><div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2"><div className="text-xs text-slate-400">Total</div><b className="text-xl">{stats.total}</b></div><div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2"><div className="text-xs text-slate-400">Livres</div><b className="text-xl">{stats.livres}</b></div><div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2"><div className="text-xs text-slate-400">Ocupados</div><b className="text-xl">{stats.ocupados}</b></div><div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2"><div className="text-xs text-slate-400">Indisp.</div><b className="text-xl">{stats.indisponiveis}</b></div></div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-9 gap-3">{beds.map(b => <div key={b.numero} className="bg-slate-900 border border-slate-800 rounded-xl p-3"><div className="text-2xl font-black">{b.numero}</div><div className="text-slate-400 text-xs mb-3">{b.andar}º andar · {b.tipo}</div><Status value={b.status}/></div>)}</div>
  </div>;
}
