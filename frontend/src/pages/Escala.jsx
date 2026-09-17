import { useEffect, useMemo, useState } from 'react';
import { api, errMsg } from '../services/api';
import { ErrorBox, Modal, PageTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';

const turnos = ['MANHA', 'TARDE', 'NOITE'];
const turnoLabel = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite' };
const dateKey = value => String(value || '').slice(0, 10);
const localDate = value => new Date(`${dateKey(value)}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const addDays = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

export default function Escala() {
  const { can } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.toISOString().slice(0, 7));
  const [list, setList] = useState([]);
  const [pros, setPros] = useState([]);
  const [q, setQ] = useState('');
  const [cargo, setCargo] = useState('');
  const [form, setForm] = useState({ profissionalId: '', data: '', turno: 'MANHA', repeticoes: 1 });
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const range = () => {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return { dataInicio: `${month}-01`, dataFim: `${month}-${String(last).padStart(2, '0')}` };
  };

  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get('/escala', { params: range() }), api.get('/profissionais', { params: { ativo: true } })]);
      setList(Array.isArray(a.data?.data) ? a.data.data : []);
      setPros(Array.isArray(b.data?.data) ? b.data.data : []);
      setError('');
    } catch (e) {
      setError(errMsg(e));
      setList([]);
    }
  };

  useEffect(() => { load(); }, [month]);

  const categorias = useMemo(() => [...new Set(pros.map(p => String(p.cargo || '').split('|')[0].trim()).filter(Boolean))].sort(), [pros]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter(x => {
      const p = x.profissional || {};
      const cat = String(p.cargo || '').split('|')[0].trim();
      return (!cargo || cat === cargo) && (!term || [p.nome, p.cargo, p.registroConselho].filter(Boolean).some(v => String(v).toLowerCase().includes(term)));
    });
  }, [list, q, cargo]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const x of filtered) {
      const key = dateKey(x.data);
      if (!map.has(key)) map.set(key, { MANHA: [], TARDE: [], NOITE: [] });
      map.get(key)[x.turno]?.push(x);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const save = async e => {
    e.preventDefault();
    try {
      const count = Number(form.repeticoes || 1);
      if (count > 1) {
        const datas = Array.from({ length: count }, (_, i) => addDays(form.data, i * 7));
        const r = await api.post('/escala/lote', { profissionalId: form.profissionalId, turno: form.turno, datas });
        const criados = r.data?.criados?.length || 0;
        const ignorados = r.data?.ignorados?.length || 0;
        setSuccess(`${criados} plantão(ões) incluído(s)${ignorados ? `; ${ignorados} repetido(s) ignorado(s)` : ''}.`);
      } else {
        await api.post('/escala', { profissionalId: form.profissionalId, data: form.data, turno: form.turno });
        setSuccess('Plantão incluído na escala.');
      }
      setForm({ ...form, data: '', repeticoes: 1 });
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const saveEdit = async e => {
    e.preventDefault();
    try {
      await api.put(`/escala/${edit.id}`, { profissionalId: edit.profissionalId, data: edit.data, turno: edit.turno });
      setEdit(null);
      setSuccess('Plantão alterado.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const remove = async item => {
    if (!window.confirm(`Remover ${item.profissional?.nome} da escala de ${localDate(item.data)} - ${turnoLabel[item.turno]}?`)) return;
    try {
      await api.delete(`/escala/${item.id}`);
      setSuccess('Plantão removido.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  return <>
    <PageTitle title="Escala" subtitle="Visão mensal por turno, filtros, edição e repetição de plantões"/>
    <ErrorBox error={error}/>
    {success && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}

    <div className="card p-4 mb-4">
      <div className="grid md:grid-cols-3 gap-3">
        <label><span className="label">Mês</span><input className="input" type="month" value={month} onChange={e => setMonth(e.target.value)}/></label>
        <label><span className="label">Buscar profissional</span><input className="input" placeholder="Nome, função ou registro" value={q} onChange={e => setQ(e.target.value)}/></label>
        <label><span className="label">Categoria</span><select className="input" value={cargo} onChange={e => setCargo(e.target.value)}><option value="">Todas</option>{categorias.map(c => <option key={c}>{c}</option>)}</select></label>
      </div>

      {can('escala', 'write') && <form onSubmit={save} className="grid md:grid-cols-5 gap-3 mt-5 pt-5 border-t">
        <label className="md:col-span-2"><span className="label">Profissional</span><select className="input" required value={form.profissionalId} onChange={e => setForm({ ...form, profissionalId: e.target.value })}><option value="">Selecione</option>{pros.map(p => <option key={p.id} value={p.id}>{p.nome} — {p.cargo}</option>)}</select></label>
        <label><span className="label">Data</span><input className="input" type="date" required value={form.data} onChange={e => setForm({ ...form, data: e.target.value })}/></label>
        <label><span className="label">Turno</span><select className="input" value={form.turno} onChange={e => setForm({ ...form, turno: e.target.value })}>{turnos.map(t => <option key={t} value={t}>{turnoLabel[t]}</option>)}</select></label>
        <label><span className="label">Repetir semanalmente</span><select className="input" value={form.repeticoes} onChange={e => setForm({ ...form, repeticoes: Number(e.target.value) })}><option value="1">Não repetir</option><option value="2">2 semanas</option><option value="4">4 semanas</option><option value="5">5 semanas</option></select></label>
        <button className="btn btn-primary md:col-span-5">Adicionar à escala</button>
      </form>}
    </div>

    <div className="grid sm:grid-cols-3 gap-3 mb-4">
      {turnos.map(t => <div className="card p-4" key={t}><div className="text-xs text-slate-500">{turnoLabel[t]}</div><div className="text-2xl font-bold">{filtered.filter(x => x.turno === t).length}</div><div className="text-xs text-slate-400">alocações no mês filtrado</div></div>)}
    </div>

    <div className="space-y-3">
      {grouped.map(([day, slots]) => <div className="card overflow-hidden" key={day}>
        <div className="px-4 py-3 bg-slate-50 border-b font-bold capitalize">{localDate(day)}</div>
        <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x">
          {turnos.map(t => <div className="p-4" key={t}>
            <div className="text-xs font-bold text-slate-500 uppercase mb-3">{turnoLabel[t]} · {slots[t].length}</div>
            <div className="space-y-2">
              {slots[t].map(x => <div className="border rounded-lg p-3 flex items-start justify-between gap-3" key={x.id}>
                <div><div className="font-semibold text-sm">{x.profissional?.nome || 'Profissional'}</div><div className="text-xs text-slate-500 mt-1">{x.profissional?.cargo || '—'}</div><div className="text-xs text-slate-400">{x.profissional?.registroConselho || ''}</div></div>
                <div className="flex gap-1">
                  {can('escala', 'write') && <button className="text-xs font-semibold text-blue-700" onClick={() => setEdit({ id: x.id, profissionalId: x.profissionalId, data: dateKey(x.data), turno: x.turno })}>Editar</button>}
                  {can('escala', 'delete') && <button className="text-xs font-semibold text-red-700" onClick={() => remove(x)}>Remover</button>}
                </div>
              </div>)}
              {!slots[t].length && <div className="text-sm text-slate-400">Nenhum profissional neste turno.</div>}
            </div>
          </div>)}
        </div>
      </div>)}
      {!grouped.length && <div className="card p-10 text-center text-slate-500">Nenhum plantão encontrado para os filtros selecionados.</div>}
    </div>

    <Modal open={!!edit} title="Editar plantão" onClose={() => setEdit(null)}>
      {edit && <form onSubmit={saveEdit} className="grid gap-3">
        <label><span className="label">Profissional</span><select className="input" value={edit.profissionalId} onChange={e => setEdit({ ...edit, profissionalId: e.target.value })}>{pros.map(p => <option key={p.id} value={p.id}>{p.nome} — {p.cargo}</option>)}</select></label>
        <div className="grid md:grid-cols-2 gap-3">
          <label><span className="label">Data</span><input type="date" className="input" value={edit.data} onChange={e => setEdit({ ...edit, data: e.target.value })}/></label>
          <label><span className="label">Turno</span><select className="input" value={edit.turno} onChange={e => setEdit({ ...edit, turno: e.target.value })}>{turnos.map(t => <option key={t} value={t}>{turnoLabel[t]}</option>)}</select></label>
        </div>
        <button className="btn btn-primary">Salvar alteração</button>
      </form>}
    </Modal>
  </>;
}
