import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg } from '../services/api';
import { ErrorBox, Modal, PageTitle, Status } from '../components/Common';
import { useAuth } from '../context/AuthContext';

const empty = { numero:'', andar:1, tipo:'ENFERMARIA', observacoes:'' };
const tipos = ['ENFERMARIA','UTI','ISOLAMENTO','SEMI_INTENSIVO'];
const statuses = ['LIVRE','OCUPADO','BLOQUEADO','MANUTENCAO','RESERVADO'];

export default function Leitos() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [block, setBlock] = useState(null);
  const [filters, setFilters] = useState({ q:'', status:'', tipo:'', andar:'' });

  const load = async () => {
    try {
      const r = await api.get('/leitos');
      setList(Array.isArray(r.data?.data) ? r.data.data : []);
      setError('');
    } catch (e) { setError(errMsg(e)); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => list.filter(l => {
    const term = filters.q.trim().toLowerCase();
    const matchesQ = !term || [l.numero,l.tipo,l.observacoes,l.internacoes?.[0]?.paciente?.nome].filter(Boolean).some(v => String(v).toLowerCase().includes(term));
    return matchesQ && (!filters.status || l.status === filters.status) && (!filters.tipo || l.tipo === filters.tipo) && (!filters.andar || String(l.andar) === String(filters.andar));
  }), [list, filters]);

  const counts = useMemo(() => Object.fromEntries(statuses.map(s => [s, list.filter(l => l.status === s).length])), [list]);
  const andares = useMemo(() => [...new Set(list.map(l => l.andar))].sort((a,b) => a-b), [list]);

  const novo = () => { setEditing(null); setForm(empty); setOpen(true); };
  const editar = l => { setEditing(l); setForm({ numero:l.numero, andar:l.andar, tipo:l.tipo, observacoes:l.observacoes || '' }); setOpen(true); };

  const save = async e => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/leitos/${editing.id}`, form);
      else await api.post('/leitos', form);
      setOpen(false);
      setEditing(null);
      setForm(empty);
      setSuccess(editing ? 'Leito atualizado.' : 'Leito criado.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const blockBed = async e => {
    e.preventDefault();
    try {
      await api.post(`/leitos/${block.id}/bloquear`, block);
      setBlock(null);
      setSuccess('Estado do leito atualizado.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const liberar = async id => {
    try {
      await api.post(`/leitos/${id}/liberar`);
      setSuccess('Leito liberado.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  return <>
    <PageTitle title="Leitos" subtitle="Mapa operacional configurável com ocupação em tempo real" action={can('leitos','write') ? <button className="btn btn-primary" onClick={novo}>Novo leito</button> : null}/>
    <ErrorBox error={error}/>
    {success && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}

    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      {statuses.map(s => <button key={s} onClick={() => setFilters({...filters,status:filters.status === s ? '' : s})} className={`card p-3 text-left ${filters.status === s ? 'ring-2 ring-blue-500' : ''}`}><div className="text-xs text-slate-500">{s.replace('_',' ')}</div><div className="text-2xl font-bold">{counts[s] || 0}</div></button>)}
    </div>

    <div className="card p-4 mb-4 grid md:grid-cols-4 gap-3">
      <input className="input" placeholder="Leito, paciente ou setor" value={filters.q} onChange={e => setFilters({...filters,q:e.target.value})}/>
      <select className="input" value={filters.tipo} onChange={e => setFilters({...filters,tipo:e.target.value})}><option value="">Todos os tipos</option>{tipos.map(t => <option key={t}>{t}</option>)}</select>
      <select className="input" value={filters.andar} onChange={e => setFilters({...filters,andar:e.target.value})}><option value="">Todos os andares</option>{andares.map(a => <option key={a} value={a}>{a}º andar</option>)}</select>
      <button className="btn btn-secondary" onClick={() => setFilters({q:'',status:'',tipo:'',andar:''})}>Limpar filtros</button>
    </div>

    <div className="text-sm text-slate-500 mb-3">Exibindo {filtered.length} de {list.length} leitos</div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {filtered.map(l => <div className="card p-4" key={l.id}>
        <div className="flex justify-between gap-3"><div><div className="text-2xl font-bold">{l.numero}</div><div className="text-sm text-slate-500">{l.andar}º andar · {l.tipo}</div></div><Status value={l.status}/></div>
        {l.observacoes && <div className="text-xs text-slate-400 mt-2">{l.observacoes}</div>}
        {l.internacoes?.[0] && <div className="mt-3 p-2 bg-red-50 rounded text-sm"><button className="font-bold text-blue-700 hover:underline text-left" onClick={() => navigate(`/pacientes/${l.internacoes[0].paciente?.id}`)}>{l.internacoes[0].paciente?.nome}</button><br/>Pront. {l.internacoes[0].paciente?.prontuario}</div>}
        {can('leitos','write') && <div className="mt-4 flex flex-wrap gap-2"><button className="btn btn-secondary text-xs" onClick={() => editar(l)}>Editar</button>{l.status === 'LIVRE' && <button className="btn btn-secondary text-xs" onClick={() => setBlock({id:l.id,tipo:'BLOQUEADO',motivo:'',dataInicio:''})}>Alterar estado</button>}{['BLOQUEADO','MANUTENCAO','RESERVADO'].includes(l.status) && <button className="btn btn-secondary text-xs" onClick={() => liberar(l.id)}>Liberar</button>}</div>}
      </div>)}
    </div>

    <Modal open={open} title={editing ? 'Editar leito' : 'Novo leito'} onClose={() => setOpen(false)}>
      <form onSubmit={save} className="grid gap-3">
        <label><span className="label">Número / identificação</span><input className="input" required value={form.numero} onChange={e => setForm({...form,numero:e.target.value})}/></label>
        <label><span className="label">Andar</span><input type="number" className="input" required value={form.andar} onChange={e => setForm({...form,andar:Number(e.target.value)})}/></label>
        <label><span className="label">Tipo</span><select className="input" value={form.tipo} onChange={e => setForm({...form,tipo:e.target.value})}>{tipos.map(t => <option key={t}>{t}</option>)}</select></label>
        <label><span className="label">Setor / observações</span><textarea className="input" value={form.observacoes} onChange={e => setForm({...form,observacoes:e.target.value})}/></label>
        <button className="btn btn-primary">{editing ? 'Salvar alterações' : 'Salvar leito'}</button>
      </form>
    </Modal>

    <Modal open={!!block} title="Alterar estado do leito" onClose={() => setBlock(null)}>
      {block && <form onSubmit={blockBed} className="grid gap-3"><label><span className="label">Estado</span><select className="input" value={block.tipo} onChange={e => setBlock({...block,tipo:e.target.value})}><option>BLOQUEADO</option><option>MANUTENCAO</option><option>RESERVADO</option></select></label><label><span className="label">Motivo</span><textarea className="input" required value={block.motivo} onChange={e => setBlock({...block,motivo:e.target.value})}/></label><button className="btn btn-primary">Confirmar</button></form>}
    </Modal>
  </>;
}
