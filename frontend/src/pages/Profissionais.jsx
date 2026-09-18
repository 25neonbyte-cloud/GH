import { useEffect, useMemo, useState } from 'react';
import { api, errMsg } from '../services/api';
import { ErrorBox, Modal, PageTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';

const categorias=['MÉDICO','ENFERMEIRO','TÉCNICO DE ENFERMAGEM','FISIOTERAPEUTA','BIOMÉDICO','ASSISTENTE SOCIAL','MAQUEIRO','FARMACÊUTICO','NUTRICIONISTA','PSICÓLOGO','FONOAUDIÓLOGO','TERAPEUTA OCUPACIONAL','ADMINISTRATIVO','RECEPÇÃO'];
const especialidades=['ALERGIA E IMUNOLOGIA','ANESTESIOLOGIA','CARDIOLOGIA','CIRURGIA CARDIOVASCULAR','CIRURGIA GERAL','CIRURGIA PEDIÁTRICA','CIRURGIA PLÁSTICA','CIRURGIA TORÁCICA','CLÍNICA MÉDICA','DERMATOLOGIA','EMERGENCISTA','ENDOCRINOLOGIA','GASTROENTEROLOGIA','GERIATRIA','GINECOLOGIA E OBSTETRÍCIA','HEMATOLOGIA','INFECTOLOGIA','MASTOLOGIA','MEDICINA INTENSIVA','NEFROLOGIA','NEUROCIRURGIA','NEUROLOGIA','OFTALMOLOGIA','ONCOLOGIA CLÍNICA','ORTOPEDIA','OTORRINOLARINGOLOGIA','PEDIATRIA','PNEUMOLOGIA','PSIQUIATRIA','RADIOLOGIA','REUMATOLOGIA','UROLOGIA'];
const modules=['pacientes','leitos','internacoes','prontuario','profissionais','escala','dashboard','sync'];
const defaultPerms={pacientes:['read'],leitos:['read'],internacoes:['read'],prontuario:['read'],escala:['read'],dashboard:['read']};
const blank=()=>({nome:'',registroConselho:'',categoria:'MÉDICO',especialidade:'',acessoEnabled:false,username:'',password:'Demo123!',acessoAtivo:true,permissoes:{...defaultPerms}});

function splitCargo(cargo=''){const [categoria,especialidade='']=String(cargo).split('|').map(x=>x.trim());return{categoria:categoria||'MÉDICO',especialidade};}

export default function Profissionais(){
  const {can,user}=useAuth();
  const [list,setList]=useState([]),[q,setQ]=useState(''),[open,setOpen]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState(blank()),[error,setError]=useState(''),[success,setSuccess]=useState('');

  const load=async()=>{try{const r=await api.get('/profissionais');setList(Array.isArray(r.data?.data)?r.data.data:[]);setError('');}catch(e){setError(errMsg(e));}};
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>{const t=q.trim().toLowerCase();return !t?list:list.filter(p=>[p.nome,p.registroConselho,p.cargo].filter(Boolean).some(v=>String(v).toLowerCase().includes(t)))},[list,q]);

  const novo=()=>{setEditing(null);setForm(blank());setOpen(true)};
  const editar=p=>{const parts=splitCargo(p.cargo);setEditing(p);setForm({nome:p.nome,registroConselho:p.registroConselho,...parts,acessoEnabled:!!p.usuario,username:p.usuario?.username||'',password:'',acessoAtivo:p.usuario?.ativo!==false,permissoes:p.usuario?.permissoes||{...defaultPerms}});setOpen(true)};

  const togglePerm=(m,a)=>{const cur=form.permissoes[m]||[];setForm({...form,permissoes:{...form.permissoes,[m]:cur.includes(a)?cur.filter(x=>x!==a):[...cur,a]}})};

  const save=async e=>{e.preventDefault();try{
    const cargo=form.especialidade.trim()?`${form.categoria} | ${form.especialidade.trim().toUpperCase()}`:form.categoria;
    const payload={nome:form.nome,registroConselho:form.registroConselho,cargo};
    if(user?.role==='ADMIN') payload.acesso={enabled:form.acessoEnabled,username:form.username,password:form.password,ativo:form.acessoAtivo,permissoes:form.permissoes};
    if(editing) await api.put(`/profissionais/${editing.id}`,payload); else await api.post('/profissionais',payload);
    setOpen(false);setSuccess(editing?'Profissional e acessos atualizados.':'Profissional cadastrado.');await load();
  }catch(e){setError(errMsg(e))}};

  const inativar=async p=>{try{
    const {data}=await api.get(`/profissionais/${p.id}/impacto-inativacao`);
    const n=data.escalasFuturas||0;
    let remover=false;
    if(n>0){const manter=window.confirm(`${p.nome} possui ${n} plantão(ões) hoje ou no futuro.\n\nOK = inativar e MANTER a escala existente.\nCancelar = escolher se deseja remover os plantões.`);if(!manter){if(!window.confirm(`Remover os ${n} plantão(ões) futuros ao inativar ${p.nome}?`))return;remover=true;}}
    else if(!window.confirm(`Inativar ${p.nome}?`))return;
    const resp=await api.post(`/profissionais/${p.id}/inativar`,{removerEscalasFuturas:remover});
    setSuccess(remover?`Profissional inativado e ${resp.data.escalasRemovidas} plantão(ões) futuro(s) removido(s).`:'Profissional inativado; histórico e escalas existentes preservados.');await load();
  }catch(e){setError(errMsg(e))}};

  const reativar=async p=>{try{await api.post(`/profissionais/${p.id}/reativar`);setSuccess('Profissional reativado.');await load()}catch(e){setError(errMsg(e))}};

  return <><PageTitle title="Profissionais" subtitle="Corpo clínico, apoio, status e acesso ao sistema" action={can('profissionais','write')?<button className="btn btn-primary" onClick={novo}>Novo profissional</button>:null}/>
  <ErrorBox error={error}/>{success&&<div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}
  <div className="card p-4 mb-4"><input className="input max-w-lg" placeholder="Buscar por nome, função, especialidade ou registro" value={q} onChange={e=>setQ(e.target.value)}/></div>
  <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Nome</th><th>Registro</th><th>Função</th><th>Acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td className="font-semibold">{p.nome}</td><td>{p.registroConselho}</td><td>{p.cargo}</td><td>{p.usuario?<span className={p.usuario.ativo?'text-blue-700 font-semibold':'text-slate-400'}>{p.usuario.username}{p.usuario.ativo?'':' (desativado)'}</span>:'—'}</td><td>{p.ativo?<span className="text-green-700 font-semibold">Ativo</span>:<span className="text-slate-400">Inativo</span>}</td><td><div className="flex gap-2 flex-wrap">{can('profissionais','write')&&<button className="text-blue-700 font-semibold text-sm" onClick={()=>editar(p)}>Editar</button>}{p.ativo&&can('profissionais','delete')&&<button className="text-red-700 font-semibold text-sm" onClick={()=>inativar(p)}>Inativar</button>}{!p.ativo&&can('profissionais','write')&&<button className="text-green-700 font-semibold text-sm" onClick={()=>reativar(p)}>Reativar</button>}</div></td></tr>)}</tbody></table></div>

  <Modal open={open} title={editing?'Editar profissional':'Novo profissional'} onClose={()=>setOpen(false)}>
    <form onSubmit={save} className="grid gap-4">
      <div className="grid md:grid-cols-2 gap-3">
        <label><span className="label">Nome</span><input className="input" required value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label>
        <label><span className="label">Registro no conselho / matrícula</span><input className="input" required value={form.registroConselho} onChange={e=>setForm({...form,registroConselho:e.target.value})}/></label>
        <label><span className="label">Categoria profissional</span><select className="input" value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value,especialidade:e.target.value==='MÉDICO'?form.especialidade:''})}>{categorias.map(c=><option key={c}>{c}</option>)}</select></label>
        <label><span className="label">Especialidade / área</span><input className="input" list="especialidades-medicas" placeholder={form.categoria==='MÉDICO'?'Comece a digitar: pediatria, ortopedia...':'Opcional'} value={form.especialidade} onChange={e=>setForm({...form,especialidade:e.target.value})}/><datalist id="especialidades-medicas">{especialidades.map(s=><option key={s} value={s}/>)}</datalist></label>
      </div>

      {user?.role==='ADMIN'&&<div className="border rounded-xl p-4 bg-slate-50">
        <label className="flex gap-2 items-center font-semibold"><input type="checkbox" checked={form.acessoEnabled} onChange={e=>setForm({...form,acessoEnabled:e.target.checked})}/> Possui acesso ao sistema</label>
        {form.acessoEnabled&&<div className="mt-4 grid gap-3">
          <div className="grid md:grid-cols-2 gap-3"><label><span className="label">Usuário</span><input className="input" required value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label><label><span className="label">{editing&&editing.usuario?'Nova senha (opcional)':'Senha inicial'}</span><input type="password" className="input" required={!editing?.usuario} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label></div>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={form.acessoAtivo} onChange={e=>setForm({...form,acessoAtivo:e.target.checked})}/> Acesso ativo</label>
          <div><div className="label">Privilégios</div><div className="border rounded-lg divide-y bg-white">{modules.map(m=><div className="p-2 grid md:grid-cols-[170px_1fr] gap-2" key={m}><b className="text-sm capitalize">{m==='sync'?'Importar / Exportar':m}</b><div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" checked={(form.permissoes[m]||[]).includes('read')} onChange={()=>togglePerm(m,'read')}/> Leitura</label><label><input type="checkbox" checked={(form.permissoes[m]||[]).includes('write')} onChange={()=>togglePerm(m,'write')}/> Modificação</label>{m==='escala'&&<label><input type="checkbox" checked={(form.permissoes[m]||[]).includes('delete')} onChange={()=>togglePerm(m,'delete')}/> Remover</label>}</div></div>)}</div></div>
        </div>}
      </div>}
      <button className="btn btn-primary">{editing?'Salvar alterações':'Cadastrar profissional'}</button>
    </form>
  </Modal></>;
}
