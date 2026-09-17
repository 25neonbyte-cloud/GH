import { useEffect, useMemo, useState } from 'react';
import { api, errMsg } from '../services/api';
import { ErrorBox, Modal, PageTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';

const categorias = ['MÉDICO','ENFERMEIRO','TÉCNICO DE ENFERMAGEM','FISIOTERAPEUTA','BIOMÉDICO','ASSISTENTE SOCIAL','MAQUEIRO','FARMACÊUTICO','NUTRICIONISTA','PSICÓLOGO','FONOAUDIÓLOGO','TERAPEUTA OCUPACIONAL','ADMINISTRATIVO','RECEPÇÃO'];
const especialidadesMedicas = ['ALERGIA E IMUNOLOGIA','ANESTESIOLOGIA','CARDIOLOGIA','CIRURGIA CARDIOVASCULAR','CIRURGIA GERAL','CIRURGIA PEDIÁTRICA','CIRURGIA PLÁSTICA','CIRURGIA TORÁCICA','CLÍNICA MÉDICA','DERMATOLOGIA','EMERGENCISTA','ENDOCRINOLOGIA','GASTROENTEROLOGIA','GERIATRIA','GINECOLOGIA E OBSTETRÍCIA','HEMATOLOGIA','INFECTOLOGIA','MASTOLOGIA','MEDICINA INTENSIVA','NEFROLOGIA','NEUROCIRURGIA','NEUROLOGIA','OFTALMOLOGIA','ONCOLOGIA CLÍNICA','ORTOPEDIA','OTORRINOLARINGOLOGIA','PEDIATRIA','PNEUMOLOGIA','PSIQUIATRIA','RADIOLOGIA','REUMATOLOGIA','UROLOGIA'];
const modules = ['pacientes','leitos','internacoes','prontuario','profissionais','escala','dashboard'];
const defaultPerms = { pacientes:['read'], leitos:['read'], internacoes:['read'], prontuario:['read'], escala:['read'], dashboard:['read'] };
const empty = { nome:'', registroConselho:'', categoria:'MÉDICO', especialidade:'', criarAcesso:false, username:'', password:'Demo123!', permissoes:defaultPerms };

const splitCargo = cargo => {
  const [categoria, especialidade = ''] = String(cargo || '').split('|').map(x => x.trim());
  return { categoria: categoria || 'MÉDICO', especialidade };
};

export default function Profissionais() {
  const { can, user } = useAuth();
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const r = await api.get('/profissionais');
      setList(Array.isArray(r.data?.data) ? r.data.data : []);
      setError('');
    } catch (e) { setError(errMsg(e)); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(p => [p.nome,p.registroConselho,p.cargo].filter(Boolean).some(v => String(v).toLowerCase().includes(term)));
  }, [list,q]);

  const novo = () => {
    setEditing(null);
    setForm({ ...empty, permissoes: { ...defaultPerms } });
    setOpen(true);
  };

  const editar = p => {
    const parts = splitCargo(p.cargo);
    setEditing(p);
    setForm({ ...empty, nome:p.nome, registroConselho:p.registroConselho, ...parts, criarAcesso:false, permissoes:{...defaultPerms} });
    setOpen(true);
  };

  const togglePerm = (module, action) => {
    const cur = form.permissoes[module] || [];
    const next = cur.includes(action) ? cur.filter(x => x !== action) : [...cur, action];
    setForm({ ...form, permissoes: { ...form.permissoes, [module]: next } });
  };

  const save = async e => {
    e.preventDefault();
    try {
      const cargo = form.especialidade.trim() ? `${form.categoria} | ${form.especialidade.trim().toUpperCase()}` : form.categoria;
      const payload = { nome:form.nome, registroConselho:form.registroConselho, cargo };
      if (editing) {
        await api.put(`/profissionais/${editing.id}`, payload);
        setSuccess('Profissional atualizado.');
      } else {
        await api.post('/profissionais', payload);
        if (form.criarAcesso && user?.role === 'ADMIN') {
          await api.post('/usuarios', { username:form.username, password:form.password, nome:form.nome, cargo, role:'USER', permissoes:form.permissoes });
        }
        setSuccess(form.criarAcesso ? 'Profissional e acesso ao sistema criados.' : 'Profissional cadastrado.');
      }
      setOpen(false);
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const inativar = async p => {
    if (!window.confirm(`Inativar ${p.nome}? O histórico de escala será preservado.`)) return;
    try {
      await api.delete(`/profissionais/${p.id}`);
      setSuccess('Profissional inativado.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  return <>
    <PageTitle title="Profissionais" subtitle="Corpo clínico, enfermagem, apoio e acesso ao sistema" action={can('profissionais','write') ? <button className="btn btn-primary" onClick={novo}>Novo profissional</button> : null}/>
    <ErrorBox error={error}/>
    {success && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}

    <div className="card p-4 mb-4"><input className="input max-w-lg" placeholder="Buscar por nome, função, especialidade ou registro" value={q} onChange={e => setQ(e.target.value)}/></div>

    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Nome</th><th>Registro / matrícula</th><th>Função</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>{filtered.map(p => <tr key={p.id}><td className="font-semibold">{p.nome}</td><td>{p.registroConselho}</td><td>{p.cargo}</td><td>{p.ativo ? <span className="text-green-700 font-semibold">Ativo</span> : <span className="text-slate-400">Inativo</span>}</td><td><div className="flex gap-2">{can('profissionais','write') && <button className="text-blue-700 font-semibold text-sm" onClick={() => editar(p)}>Editar</button>}{p.ativo && can('profissionais','delete') && <button className="text-red-700 font-semibold text-sm" onClick={() => inativar(p)}>Inativar</button>}</div></td></tr>)}</tbody>
      </table>
    </div>

    <Modal open={open} title={editing ? 'Editar profissional' : 'Novo profissional'} onClose={() => setOpen(false)}>
      <form onSubmit={save} className="grid gap-4">
        <div className="grid md:grid-cols-2 gap-3">
          <label><span className="label">Nome</span><input className="input" required value={form.nome} onChange={e => setForm({...form,nome:e.target.value})}/></label>
          <label><span className="label">Registro no conselho / matrícula</span><input className="input" required placeholder="Ex.: CRM-GO 12345 ou MAT-001" value={form.registroConselho} onChange={e => setForm({...form,registroConselho:e.target.value})}/></label>
          <label><span className="label">Categoria profissional</span><select className="input" value={form.categoria} onChange={e => setForm({...form,categoria:e.target.value,especialidade:e.target.value === 'MÉDICO' ? form.especialidade : ''})}>{categorias.map(c => <option key={c}>{c}</option>)}</select></label>
          <label><span className="label">Especialidade / área</span><input className="input" list="especialidades-medicas" placeholder={form.categoria === 'MÉDICO' ? 'Comece a digitar: pediatria, ortopedia...' : 'Opcional'} value={form.especialidade} onChange={e => setForm({...form,especialidade:e.target.value})}/><datalist id="especialidades-medicas">{especialidadesMedicas.map(s => <option key={s} value={s}/>)}</datalist></label>
        </div>

        {!editing && user?.role === 'ADMIN' && <div className="border rounded-xl p-4 bg-slate-50">
          <label className="flex gap-2 items-center font-semibold"><input type="checkbox" checked={form.criarAcesso} onChange={e => setForm({...form,criarAcesso:e.target.checked})}/> Dar acesso ao sistema para este profissional</label>
          {form.criarAcesso && <div className="mt-4 grid gap-3">
            <div className="grid md:grid-cols-2 gap-3"><label><span className="label">Usuário</span><input className="input" required value={form.username} onChange={e => setForm({...form,username:e.target.value})}/></label><label><span className="label">Senha inicial</span><input type="password" className="input" required value={form.password} onChange={e => setForm({...form,password:e.target.value})}/></label></div>
            <div><div className="label">Nível de acesso</div><div className="border rounded-lg divide-y bg-white">{modules.map(m => <div className="p-2 grid grid-cols-[140px_1fr] gap-2" key={m}><b className="text-sm capitalize">{m}</b><div className="flex gap-4 text-sm"><label><input type="checkbox" checked={(form.permissoes[m]||[]).includes('read')} onChange={() => togglePerm(m,'read')}/> Leitura</label><label><input type="checkbox" checked={(form.permissoes[m]||[]).includes('write')} onChange={() => togglePerm(m,'write')}/> Modificação</label>{m === 'escala' && <label><input type="checkbox" checked={(form.permissoes[m]||[]).includes('delete')} onChange={() => togglePerm(m,'delete')}/> Remover</label>}</div></div>)}</div></div>
          </div>}
        </div>}

        <button className="btn btn-primary">{editing ? 'Salvar alterações' : 'Cadastrar profissional'}</button>
      </form>
    </Modal>
  </>;
}
