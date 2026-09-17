import { useEffect, useState } from 'react';
import { api, errMsg } from '../services/api';
import { ErrorBox, Modal, PageTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';

const empty = { prontuario:'', nome:'', cpf:'', dataNascimento:'', sexo:'', nomeAcompanhante:'', telefoneContato:'', diagnostico:'', precaucoes:[] };
const toDateInput = value => value ? String(value).slice(0,10) : '';

export default function Pacientes() {
  const { can } = useAuth();
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const r = await api.get('/pacientes', { params: { search:q } });
      setList(Array.isArray(r.data?.data) ? r.data.data : []);
      setError('');
    } catch (e) { setError(errMsg(e)); }
  };

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);

  const novo = () => { setEditing(null); setForm(empty); setOpen(true); };
  const editar = p => {
    setEditing(p);
    setForm({
      prontuario:p.prontuario || '', nome:p.nome || '', cpf:p.cpf || '', dataNascimento:toDateInput(p.dataNascimento), sexo:p.sexo || '',
      nomeAcompanhante:p.nomeAcompanhante || '', telefoneContato:p.telefoneContato || '', diagnostico:p.diagnostico || '', precaucoes:p.precaucoes || [],
    });
    setOpen(true);
  };

  const save = async e => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/pacientes/${editing.id}`, form);
      else await api.post('/pacientes', form);
      setOpen(false);
      setForm(empty);
      setSuccess(editing ? 'Paciente atualizado.' : 'Paciente cadastrado.');
      setEditing(null);
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const remove = async p => {
    if (!window.confirm(`Excluir o cadastro de ${p.nome}? Pacientes com internação ativa não podem ser excluídos.`)) return;
    try {
      await api.delete(`/pacientes/${p.id}`);
      setSuccess('Cadastro removido.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const toggle = p => setForm({ ...form, precaucoes:form.precaucoes.includes(p) ? form.precaucoes.filter(x => x !== p) : [...form.precaucoes,p] });

  return <>
    <PageTitle title="Pacientes" subtitle="Cadastro único, pesquisável e editável" action={can('pacientes','write') ? <button className="btn btn-primary" onClick={novo}>Novo paciente</button> : null}/>
    <ErrorBox error={error}/>
    {success && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}
    <div className="card p-4 mb-4 flex gap-3 items-center"><input className="input max-w-lg" placeholder="Buscar por nome, prontuário ou CPF" value={q} onChange={e => setQ(e.target.value)}/><span className="text-sm text-slate-500">{list.length} resultado(s)</span></div>

    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Prontuário</th><th>Nome</th><th>Nascimento</th><th>Diagnóstico</th><th>Internação</th><th>Ações</th></tr></thead>
        <tbody>{list.map(p => <tr key={p.id}>
          <td>{p.prontuario}</td><td className="font-semibold">{p.nome}</td><td>{p.dataNascimento ? new Date(p.dataNascimento).toLocaleDateString('pt-BR') : '—'}</td><td>{p.diagnostico || '—'}</td><td>{p.internacoes?.[0] ? <span className="font-semibold text-blue-700">Leito {p.internacoes[0].leito?.numero}</span> : '—'}</td>
          <td><div className="flex gap-2">{can('pacientes','write') && <button className="text-blue-700 font-semibold text-sm" onClick={() => editar(p)}>Editar</button>}{can('pacientes','delete') && <button className="text-red-700 font-semibold text-sm" onClick={() => remove(p)}>Excluir</button>}</div></td>
        </tr>)}</tbody>
      </table>
    </div>

    <Modal open={open} title={editing ? 'Editar paciente' : 'Novo paciente'} onClose={() => setOpen(false)}>
      <form onSubmit={save} className="grid md:grid-cols-2 gap-3">
        {[['prontuario','Prontuário'],['nome','Nome'],['cpf','CPF'],['dataNascimento','Data de nascimento'],['nomeAcompanhante','Acompanhante'],['telefoneContato','Telefone'],['diagnostico','Diagnóstico']].map(([k,l]) => <label key={k} className={k === 'diagnostico' ? 'md:col-span-2' : ''}><span className="label">{l}</span><input className="input" type={k === 'dataNascimento' ? 'date' : 'text'} required={['prontuario','nome','dataNascimento'].includes(k)} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}/></label>)}
        <label><span className="label">Sexo</span><select className="input" value={form.sexo} onChange={e => setForm({...form,sexo:e.target.value})}><option value="">Não informado</option><option value="M">Masculino</option><option value="F">Feminino</option><option value="OUTRO">Outro</option></select></label>
        <div><span className="label">Precauções</span><div className="flex flex-wrap gap-3 text-sm">{['ISOLAMENTO','COVID','ALERGIA_LATEX'].map(p => <label key={p}><input type="checkbox" checked={form.precaucoes.includes(p)} onChange={() => toggle(p)}/> {p.replace('_',' ')}</label>)}</div></div>
        <button className="btn btn-primary md:col-span-2">{editing ? 'Salvar alterações' : 'Salvar paciente'}</button>
      </form>
    </Modal>
  </>;
}
