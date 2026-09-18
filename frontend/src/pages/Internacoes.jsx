import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../services/api';
import { ErrorBox, Modal, PageTitle, Status } from '../components/Common';
import { useAuth } from '../context/AuthContext';

const emptyForm = { pacienteId: '', leitoId: '', dataInternacao: '', previsaoAlta: '', observacoesInternacao: '' };
const fmt = value => value ? new Date(value).toLocaleString('pt-BR') : '—';

export default function Internacoes() {
  const { can } = useAuth();
  const [status, setStatus] = useState('ATIVA');
  const [list, setList] = useState([]);
  const [patients, setPatients] = useState([]);
  const [beds, setBeds] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [alta, setAlta] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const r = await api.get('/internacoes', { params: { status } });
      setList(Array.isArray(r.data?.data) ? r.data.data : []);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  };

  useEffect(() => { load(); }, [status]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(i => [i?.paciente?.nome, i?.paciente?.prontuario, i?.leito?.numero, i?.leito?.tipo]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(term)));
  }, [list, q]);

  const loadBeds = async () => {
    const r = await api.get('/leitos/disponiveis');
    const data = Array.isArray(r.data?.data) ? r.data.data : [];
    setBeds(data);
    return data;
  };

  const start = async () => {
    try {
      const [p, b] = await Promise.all([api.get('/pacientes'), api.get('/leitos/disponiveis')]);
      setPatients((Array.isArray(p.data?.data) ? p.data.data : []).filter(x => !(x.internacoes?.length)));
      setBeds(Array.isArray(b.data?.data) ? b.data.data : []);
      setForm(emptyForm);
      setOpen(true);
      setError('');
    } catch (e) { setError(errMsg(e)); }
  };

  const save = async e => {
    e.preventDefault();
    try {
      await api.post('/internacoes', { ...form, dataInternacao: form.dataInternacao || undefined, previsaoAlta: form.previsaoAlta || undefined });
      setOpen(false);
      setSuccess('Internação registrada e leito atualizado.');
      setStatus('ATIVA');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const discharge = async e => {
    e.preventDefault();
    try {
      await api.put(`/internacoes/${alta.id}/finalizar`, { dataAlta: alta.dataAlta || undefined, observacoesAlta: alta.observacoesAlta });
      setAlta(null);
      setSuccess('Alta registrada e leito liberado.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const openTransfer = async item => {
    try {
      const livres = await loadBeds();
      setTransfer({ ...item, novoLeitoId: '', motivo: '', livres });
    } catch (e) { setError(errMsg(e)); }
  };

  const doTransfer = async e => {
    e.preventDefault();
    try {
      await api.post(`/internacoes/${transfer.id}/transferir`, { novoLeitoId: transfer.novoLeitoId, motivo: transfer.motivo });
      setTransfer(null);
      setSuccess('Transferência concluída. Os dois leitos foram atualizados.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  return <>
    <PageTitle
      title="Internações"
      subtitle="Internação, transferência, alta e histórico em um único fluxo"
      action={can('internacoes', 'write') ? <button className="btn btn-primary" onClick={start}>Nova internação</button> : null}
    />

    <ErrorBox error={error}/>
    {success && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}

    <div className="card p-4 mb-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
      <div className="flex gap-2">
        <button className={`btn ${status === 'ATIVA' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatus('ATIVA')}>Ativas</button>
        <button className={`btn ${status === 'FINALIZADA' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatus('FINALIZADA')}>Histórico de internações</button>
      </div>
      <input className="input lg:max-w-md" placeholder="Buscar paciente, prontuário ou leito" value={q} onChange={e => setQ(e.target.value)}/>
    </div>

    <div className="grid sm:grid-cols-3 gap-3 mb-4">
      <div className="card p-4"><div className="text-xs text-slate-500">Exibindo</div><div className="text-2xl font-bold">{filtered.length}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Situação</div><div className="text-lg font-bold">{status === 'ATIVA' ? 'Internações ativas' : 'Histórico de internações'}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Atualização</div><div className="text-lg font-bold">Tempo real</div></div>
    </div>

    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Paciente</th><th>Prontuário</th><th>Leito</th><th>Entrada</th><th>{status === 'ATIVA' ? 'Previsão de alta' : 'Alta'}</th><th>LOS</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          {filtered.map(i => <tr key={i.id}>
            <td className="font-semibold"><Link className="text-blue-700 hover:underline" to={`/pacientes/${i.paciente?.id}`}>{i.paciente?.nome || 'Paciente'}</Link></td>
            <td>{i.paciente?.prontuario || '—'}</td>
            <td>{i.leito?.numero || '—'} · {i.leito?.tipo || '—'}</td>
            <td>{fmt(i.dataInternacao)}</td>
            <td>{fmt(status === 'ATIVA' ? i.previsaoAlta : i.dataAlta)}</td>
            <td>{i.los ?? '—'} dias</td>
            <td><Status value={i.status}/></td>
            <td>
              {status === 'ATIVA' && can('internacoes', 'write') && <div className="flex gap-2 flex-wrap">
                <button className="btn btn-secondary text-xs" onClick={() => openTransfer(i)}>Transferir</button>
                <button className="btn btn-primary text-xs" onClick={() => setAlta({ ...i, dataAlta: '', observacoesAlta: '' })}>Dar alta</button>
              </div>}
              {status === 'FINALIZADA' && <span className="text-xs text-slate-400">Concluída</span>}
            </td>
          </tr>)}
          {!filtered.length && <tr><td colSpan="8" className="text-center text-slate-500 py-8">Nenhuma internação encontrada para este filtro.</td></tr>}
        </tbody>
      </table>
    </div>

    <Modal open={open} title="Nova internação" onClose={() => setOpen(false)}>
      <form onSubmit={save} className="grid gap-4">
        <label><span className="label">1. Paciente sem internação ativa</span><select className="input" required value={form.pacienteId} onChange={e => setForm({ ...form, pacienteId: e.target.value })}><option value="">Selecione</option>{patients.map(p => <option value={p.id} key={p.id}>{p.prontuario} — {p.nome}</option>)}</select></label>
        <label><span className="label">2. Leito livre</span><select className="input" required value={form.leitoId} onChange={e => setForm({ ...form, leitoId: e.target.value })}><option value="">Selecione</option>{beds.map(b => <option value={b.id} key={b.id}>{b.numero} — {b.andar}º andar — {b.tipo}</option>)}</select></label>
        <div className="grid md:grid-cols-2 gap-3">
          <label><span className="label">Data/hora da internação</span><input type="datetime-local" className="input" value={form.dataInternacao} onChange={e => setForm({ ...form, dataInternacao: e.target.value })}/><small className="text-slate-400">Em branco = agora</small></label>
          <label><span className="label">Previsão de alta</span><input type="date" className="input" value={form.previsaoAlta} onChange={e => setForm({ ...form, previsaoAlta: e.target.value })}/></label>
        </div>
        <label><span className="label">Observações</span><textarea className="input" value={form.observacoesInternacao} onChange={e => setForm({ ...form, observacoesInternacao: e.target.value })}/></label>
        <button className="btn btn-primary">Confirmar internação</button>
      </form>
    </Modal>

    <Modal open={!!alta} title="Confirmar alta" onClose={() => setAlta(null)}>
      {alta && <form onSubmit={discharge} className="grid gap-3">
        <div className="bg-slate-50 rounded p-3 text-sm"><b>{alta.paciente?.nome}</b><br/>Leito {alta.leito?.numero} · LOS {alta.los} dias</div>
        <label><span className="label">Data/hora da alta</span><input type="datetime-local" className="input" value={alta.dataAlta} onChange={e => setAlta({ ...alta, dataAlta: e.target.value })}/><small className="text-slate-400">Em branco = agora</small></label>
        <label><span className="label">Observações de alta</span><textarea className="input" value={alta.observacoesAlta} onChange={e => setAlta({ ...alta, observacoesAlta: e.target.value })}/></label>
        <button className="btn btn-primary">Confirmar alta</button>
      </form>}
    </Modal>

    <Modal open={!!transfer} title="Transferir paciente" onClose={() => setTransfer(null)}>
      {transfer && <form onSubmit={doTransfer} className="grid gap-3">
        <div className="bg-slate-50 rounded p-3 text-sm"><b>{transfer.paciente?.nome}</b><br/>Leito atual: {transfer.leito?.numero}</div>
        <label><span className="label">Novo leito livre</span><select className="input" required value={transfer.novoLeitoId} onChange={e => setTransfer({ ...transfer, novoLeitoId: e.target.value })}><option value="">Selecione</option>{beds.map(b => <option key={b.id} value={b.id}>{b.numero} — {b.andar}º andar — {b.tipo}</option>)}</select></label>
        <label><span className="label">Motivo / observação</span><textarea className="input" value={transfer.motivo} onChange={e => setTransfer({ ...transfer, motivo: e.target.value })}/></label>
        <button className="btn btn-primary">Confirmar transferência</button>
      </form>}
    </Modal>
  </>;
}
