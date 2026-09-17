import { useEffect, useState } from 'react';
import { api, errMsg } from '../services/api';
import { ErrorBox, PageTitle } from '../components/Common';

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [hist, setHist] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [a,b] = await Promise.all([api.get('/dashboard/indicadores'), api.get('/dashboard/ocupacao-7dias')]);
      setD(a.data);
      setHist(Array.isArray(b.data?.data) ? b.data.data : []);
      setError('');
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { load(); const t = setInterval(load, 300000); return () => clearInterval(t); }, []);

  const cards = d ? [
    ['Capacidade cadastrada', d.capacidadeTotal],
    ['Taxa de ocupação', `${d.taxaOcupacao}%`],
    ['Leitos ocupados', d.leitosOcupados],
    ['Leitos livres', d.leitosLivres],
    ['Indisponíveis', d.leitosIndisponiveis],
    ['Internações ativas', d.internacoesAtivas],
    ['Internações hoje', d.internacoesHoje],
    ['Altas hoje', d.altasHoje],
    ['Média LOS', `${d.mediaLOS} dias`],
  ] : [];

  return <>
    <PageTitle title="Dashboard" subtitle="Visão operacional calculada automaticamente a partir dos fluxos do hospital"/>
    <ErrorBox error={error}/>
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {cards.map(([k,v]) => <div className="card p-5" key={k}><div className="text-slate-500 text-sm">{k}</div><div className="text-3xl font-bold mt-2">{v ?? '—'}</div></div>)}
    </div>
    <div className="card p-5 mt-5">
      <div className="flex justify-between items-center mb-4"><h2 className="font-bold">Ocupação — 7 dias</h2>{d?.ultimaAtualizacao && <span className="text-xs text-slate-400">Atualizado {new Date(d.ultimaAtualizacao).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>}</div>
      <div className="space-y-3">{hist.map(x => <div key={x.data} className="grid grid-cols-[100px_1fr_60px] items-center gap-3 text-sm"><span>{new Date(`${x.data}T12:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span><div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600" style={{width:`${Math.min(x.taxa,100)}%`}}/></div><b>{x.taxa}%</b></div>)}</div>
    </div>
  </>;
}
