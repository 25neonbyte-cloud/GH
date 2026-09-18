import { useEffect,useMemo,useState } from 'react';
import axios from 'axios';
import { Status } from '../components/Common';

const base=import.meta.env.VITE_API_URL||'http://localhost:3001/api';

export default function TV(){
  const [token,setToken]=useState(sessionStorage.getItem('tv_token')||''),[pass,setPass]=useState(''),[beds,setBeds]=useState([]),[error,setError]=useState('');
  const [andar,setAndar]=useState(''),[tipo,setTipo]=useState(''),[compact,setCompact]=useState(true);

  const login=async e=>{e.preventDefault();try{const {data}=await axios.post(`${base}/auth/tv`,{password:pass});sessionStorage.setItem('tv_token',data.token);setToken(data.token);setError('')}catch{setError('Senha inválida')}};
  const load=async()=>{if(!token)return;try{const {data}=await axios.get(`${base}/tv/leitos`,{headers:{Authorization:`Bearer ${token}`}});setBeds(Array.isArray(data?.data)?data.data:[]);setError('')}catch(e){if(e.response?.status===401||e.response?.status===403){setError('Sessão expirada');sessionStorage.removeItem('tv_token');setToken('')}else setError('Não foi possível atualizar agora; o último mapa recebido foi mantido.')}};
  useEffect(()=>{load();const t=setInterval(load,30000);return()=>clearInterval(t)},[token]);

  const andares=useMemo(()=>[...new Set(beds.map(b=>b.andar))].sort((a,b)=>a-b),[beds]);
  const tipos=useMemo(()=>[...new Set(beds.map(b=>b.tipo))].sort(),[beds]);
  const filtered=useMemo(()=>beds.filter(b=>(!andar||String(b.andar)===andar)&&(!tipo||b.tipo===tipo)),[beds,andar,tipo]);
  const stats=useMemo(()=>({total:filtered.length,livres:filtered.filter(b=>b.status==='LIVRE').length,ocupados:filtered.filter(b=>b.status==='OCUPADO').length,indisponiveis:filtered.filter(b=>['BLOQUEADO','MANUTENCAO','RESERVADO'].includes(b.status)).length}),[filtered]);

  if(!token)return <div className="min-h-screen grid place-items-center bg-slate-900 text-white"><form onSubmit={login} className="w-80"><h1 className="text-2xl font-bold mb-1">Modo TV</h1><p className="text-slate-400 text-sm mb-4">Painel passivo de ocupação, sem dados clínicos ou identificação do paciente</p><input type="password" className="input text-slate-900" placeholder="Senha" value={pass} onChange={e=>setPass(e.target.value)}/>{error&&<p className="text-red-300 mt-2">{error}</p>}<button className="btn btn-primary w-full mt-3">Acessar</button></form></div>;

  return <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
    <div className="flex flex-col 2xl:flex-row 2xl:justify-between 2xl:items-end gap-4 mb-4">
      <div><h1 className="text-3xl font-bold">Mapa de Leitos</h1><p className="text-slate-400">Painel somente leitura · atualização automática a cada 30 segundos</p></div>
      <div className="grid grid-cols-4 gap-2 text-center">{[['Total',stats.total],['Livres',stats.livres],['Ocupados',stats.ocupados],['Indisp.',stats.indisponiveis]].map(([k,v])=><div key={k} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2"><div className="text-xs text-slate-400">{k}</div><b className="text-xl">{v}</b></div>)}</div>
    </div>

    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-end">
      <label><span className="block text-xs text-slate-400 mb-1">Andar</span><select className="input text-slate-900 min-w-40" value={andar} onChange={e=>setAndar(e.target.value)}><option value="">Todos</option>{andares.map(a=><option key={a} value={a}>{a}º andar</option>)}</select></label>
      <label><span className="block text-xs text-slate-400 mb-1">Tipo</span><select className="input text-slate-900 min-w-48" value={tipo} onChange={e=>setTipo(e.target.value)}><option value="">Todos</option>{tipos.map(t=><option key={t}>{t}</option>)}</select></label>
      <label className="flex gap-2 items-center pb-2 text-sm"><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/> Cards compactos</label>
      <button className="btn bg-slate-800" onClick={()=>{setAndar('');setTipo('')}}>Limpar filtros</button>
      <span className="text-xs text-slate-500 ml-auto pb-2">Configurações afetam somente esta tela.</span>
    </div>

    {error&&<div className="mb-3 text-amber-300">{error}</div>}
    <div className={`grid ${compact?'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-9':'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5'} gap-3`}>{filtered.map(b=><div key={b.numero} className="bg-slate-900 border border-slate-800 rounded-xl p-3"><div className={compact?'text-2xl font-black':'text-3xl font-black'}>{b.numero}</div><div className="text-slate-400 text-xs mb-3">{b.andar}º andar · {b.tipo}</div><Status value={b.status}/></div>)}</div>
  </div>;
}
