import { useEffect, useState } from 'react';
import { api, errMsg } from '../services/api';
import { ErrorBox, Modal, PageTitle } from '../components/Common';

const modules = ['pacientes','leitos','internacoes','prontuario','profissionais','escala','dashboard','sync'];
const empty = { username:'', password:'', nome:'', cargo:'', role:'USER', permissoes:{ dashboard:['read'] }, ativo:true };
const actionLabel = { read:'Leitura', write:'Modificação', delete:'Remoção' };

export default function Usuarios() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const r = await api.get('/usuarios');
      setList(Array.isArray(r.data?.data) ? r.data.data : []);
      setError('');
    } catch (e) { setError(errMsg(e)); }
  };
  useEffect(() => { load(); }, []);

  const novo = () => { setEditing(null); setForm({ ...empty, permissoes:{ dashboard:['read'] } }); setOpen(true); };
  const editar = u => {
    setEditing(u);
    setForm({ username:u.username || '', password:'', nome:u.nome || '', cargo:u.cargo || '', role:u.role || 'USER', permissoes:u.permissoes || {}, ativo:u.ativo !== false });
    setOpen(true);
  };

  const toggle = (m, a) => {
    const cur = form.permissoes[m] || [];
    setForm({ ...form, permissoes:{ ...form.permissoes, [m]:cur.includes(a) ? cur.filter(x => x !== a) : [...cur,a] } });
  };

  const save = async e => {
    e.preventDefault();
    try {
      const payload = { username:form.username, nome:form.nome, cargo:form.cargo, role:form.role, permissoes:form.role === 'ADMIN' ? {} : form.permissoes, ativo:form.ativo };
      if (form.password) payload.password = form.password;
      if (editing) await api.put(`/usuarios/${editing.id}`, payload);
      else await api.post('/usuarios', { ...payload, password:form.password });
      setOpen(false);
      setSuccess(editing ? 'Usuário e permissões atualizados.' : 'Usuário criado.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  const toggleActive = async u => {
    try {
      await api.put(`/usuarios/${u.id}`, { ativo:!u.ativo });
      setSuccess(u.ativo ? 'Acesso desativado.' : 'Acesso reativado.');
      await load();
    } catch (e) { setError(errMsg(e)); }
  };

  return <>
    <PageTitle title="Usuários e acessos" subtitle="Perfis administrativos e permissões por módulo" action={<button className="btn btn-primary" onClick={novo}>Novo usuário</button>}/>
    <ErrorBox error={error}/>
    {success && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}

    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Usuário</th><th>Nome</th><th>Cargo</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>{list.map(u => <tr key={u.id}><td className="font-semibold">{u.username}</td><td>{u.nome}</td><td>{u.cargo || '—'}</td><td>{u.role}</td><td>{u.ativo ? <span className="text-green-700 font-semibold">Ativo</span> : <span className="text-slate-400">Inativo</span>}</td><td><div className="flex gap-2"><button className="text-blue-700 font-semibold text-sm" onClick={() => editar(u)}>Editar</button>{u.username !== 'admin' && <button className={`font-semibold text-sm ${u.ativo ? 'text-red-700' : 'text-green-700'}`} onClick={() => toggleActive(u)}>{u.ativo ? 'Desativar' : 'Reativar'}</button>}</div></td></tr>)}</tbody>
      </table>
    </div>

    <Modal open={open} title={editing ? 'Editar usuário e permissões' : 'Novo usuário'} onClose={() => setOpen(false)}>
      <form onSubmit={save} className="grid gap-4">
        <div className="grid md:grid-cols-2 gap-3">
          <label><span className="label">Usuário</span><input className="input" required value={form.username} onChange={e => setForm({...form,username:e.target.value})}/></label>
          <label><span className="label">{editing ? 'Nova senha (opcional)' : 'Senha inicial'}</span><input type="password" className="input" required={!editing} value={form.password} onChange={e => setForm({...form,password:e.target.value})}/></label>
          <label><span className="label">Nome</span><input className="input" required value={form.nome} onChange={e => setForm({...form,nome:e.target.value})}/></label>
          <label><span className="label">Cargo / função</span><input className="input" value={form.cargo} onChange={e => setForm({...form,cargo:e.target.value})}/></label>
        </div>
        <label><span className="label">Perfil</span><select className="input" value={form.role} onChange={e => setForm({...form,role:e.target.value})}><option value="USER">Usuário com permissões selecionadas</option><option value="ADMIN">Administrador completo</option></select></label>
        {editing && <label className="flex gap-2 items-center"><input type="checkbox" checked={form.ativo} onChange={e => setForm({...form,ativo:e.target.checked})}/> Acesso ativo</label>}
        {form.role !== 'ADMIN' && <div><div className="label">Permissões</div><div className="border rounded-lg divide-y">{modules.map(m => <div className="p-3 grid md:grid-cols-[160px_1fr] gap-2" key={m}><b className="text-sm capitalize">{m==='sync'?'Importar / Exportar':m}</b><div className="flex flex-wrap gap-4 text-sm">{['read','write','delete'].map(a => <label key={a}><input type="checkbox" checked={(form.permissoes[m]||[]).includes(a)} onChange={() => toggle(m,a)}/> {actionLabel[a]}</label>)}</div></div>)}</div></div>}
        <button className="btn btn-primary">{editing ? 'Salvar alterações' : 'Criar usuário'}</button>
      </form>
    </Modal>
  </>;
}
