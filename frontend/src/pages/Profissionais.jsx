import { useEffect,useMemo,useState } from 'react';
import { api,errMsg } from '../services/api';
import { ErrorBox,Modal,PageTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';

const categorias=['MÉDICO','ENFERMEIRO','TÉCNICO DE ENFERMAGEM','FISIOTERAPEUTA','BIOMÉDICO','ASSISTENTE SOCIAL','MAQUEIRO','FARMACÊUTICO','NUTRICIONISTA','PSICÓLOGO','FONOAUDIÓLOGO','TERAPEUTA OCUPACIONAL','ADMINISTRATIVO','RECEPÇÃO'];
const especialidades=['ALERGIA E IMUNOLOGIA','ANESTESIOLOGIA','CARDIOLOGIA','CIRURGIA CARDIOVASCULAR','CIRURGIA GERAL','CIRURGIA PEDIÁTRICA','CIRURGIA PLÁSTICA','CIRURGIA TORÁCICA','CLÍNICA MÉDICA','DERMATOLOGIA','EMERGENCISTA','ENDOCRINOLOGIA','GASTROENTEROLOGIA','GERIATRIA','GINECOLOGIA E OBSTETRÍCIA','HEMATOLOGIA','INFECTOLOGIA','MASTOLOGIA','MEDICINA INTENSIVA','NEFROLOGIA','NEUROCIRURGIA','NEUROLOGIA','OFTALMOLOGIA','ONCOLOGIA CLÍNICA','ORTOPEDIA','OTORRINOLARINGOLOGIA','PEDIATRIA','PNEUMOLOGIA','PSIQUIATRIA','RADIOLOGIA','REUMATOLOGIA','UROLOGIA'];
const modules=['pacientes','leitos','internacoes','prontuario','profissionais','escala','dashboard','sync'];
const defaultPerms={pacientes:['read'],leitos:['read'],internacoes:['read'],prontuario:['read'],escala:['read'],dashboard:['read']};
const blank=()=>({nome:'',registroConselho:'',categoria:'MÉDICO',especialidade:'',departamentoPrincipalId:'',acessoEnabled:false,username:'',password:'Demo123!',acessoAtivo:true,permissoes:{...defaultPerms}});
const splitCargo=(cargo='')=>{const [categoria,especialidade='']=String(cargo).split('|').map(x=>x.trim());return{categoria:categoria||'MÉDICO',especialidade};};
const fmtDate=value=>value?new Date(value).toLocaleDateString('pt-BR',{timeZone:'UTC'}):'—';

export default function Profissionais(){
  const {can,user}=useAuth();
  const [list,setList]=useState([]),[deps,setDeps]=useState([]),[q,setQ]=useState(''),[deptFilter,setDeptFilter]=useState('');
  const [open,setOpen]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState(blank());
  const [absence,setAbsence]=useState(null),[impact,setImpact]=useState(null);
  const [error,setError]=useState(''),[success,setSuccess]=useState('');

  const load=async()=>{try{
    const [p,d]=await Promise.all([api.get('/profissionais'),api.get('/departamentos')]);
    setList(Array.isArray(p.data?.data)?p.data.data:[]);
    setDeps(Array.isArray(d.data?.data)?d.data.data:[]);
    setError('');
  }catch(e){setError(errMsg(e));}};
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>{
    const t=q.trim().toLowerCase();
    return list.filter(p=>{
      const matchesText=!t||[p.nome,p.registroConselho,p.cargo,p.departamentoPrincipal?.nome].filter(Boolean).some(v=>String(v).toLowerCase().includes(t));
      return matchesText&&(!deptFilter||p.departamentoPrincipalId===deptFilter);
    });
  },[list,q,deptFilter]);

  const novo=()=>{setEditing(null);setForm(blank());setOpen(true)};
  const editar=p=>{
    const parts=splitCargo(p.cargo);
    setEditing(p);
    setForm({
      nome:p.nome,registroConselho:p.registroConselho,...parts,
      departamentoPrincipalId:p.departamentoPrincipalId||'',
      acessoEnabled:!!p.usuario?.ativo,username:p.usuario?.username||'',password:'',
      acessoAtivo:p.usuario?.ativo!==false,permissoes:p.usuario?.permissoes||{...defaultPerms},
    });
    setOpen(true);
  };

  const togglePerm=(m,a)=>{
    const cur=form.permissoes[m]||[];
    setForm({...form,permissoes:{...form.permissoes,[m]:cur.includes(a)?cur.filter(x=>x!==a):[...cur,a]}});
  };

  const save=async e=>{e.preventDefault();try{
    const cargo=form.especialidade.trim()?form.categoria+' | '+form.especialidade.trim().toUpperCase():form.categoria;
    const payload={nome:form.nome,registroConselho:form.registroConselho,cargo,departamentoPrincipalId:form.departamentoPrincipalId};
    if(user?.role==='ADMIN') payload.acesso={enabled:form.acessoEnabled,username:form.username,password:form.password,ativo:form.acessoAtivo,permissoes:form.permissoes};
    if(editing) await api.put('/profissionais/'+editing.id,payload); else await api.post('/profissionais',payload);
    setOpen(false);setSuccess(editing?'Profissional e acessos atualizados.':'Profissional cadastrado.');await load();
  }catch(e){setError(errMsg(e))}};

  const refreshImpact=async state=>{
    if(!state?.profissional)return;
    try{
      const dias=state.modo==='TEMPORARIA'?Math.max(1,Number(state.dias||1)):1;
      const {data}=await api.get('/profissionais/'+state.profissional.id+'/impacto-inativacao',{params:{dias}});
      setImpact(data);
    }catch(e){setError(errMsg(e))}
  };

  const abrirInativacao=p=>{
    const state={profissional:p,modo:'TEMPORARIA',dias:7,motivo:''};
    setAbsence(state);setImpact(null);refreshImpact(state);
  };

  const changeAbsence=next=>{setAbsence(next);refreshImpact(next)};

  const confirmarInativacao=async e=>{e.preventDefault();try{
    const payload={modo:absence.modo,dias:Number(absence.dias||1),motivo:absence.motivo};
    const resp=await api.post('/profissionais/'+absence.profissional.id+'/inativar',payload);
    setAbsence(null);
    setImpact(null);
    setSuccess(absence.modo==='TEMPORARIA'
      ? 'Afastamento registrado e '+resp.data.escalasRemovidas+' plantão(ões) do período removido(s).'
      : 'Profissional inativado e '+resp.data.escalasRemovidas+' plantão(ões) futuro(s) removido(s).');
    await load();
  }catch(e){setError(errMsg(e))}};

  const reativar=async p=>{try{
    await api.post('/profissionais/'+p.id+'/reativar');
    setSuccess('Profissional reativado e indisponibilidades abertas encerradas.');
    await load();
  }catch(e){setError(errMsg(e))}};

  return <><PageTitle title="Profissionais" subtitle="Corpo clínico, departamento, disponibilidade e acesso ao sistema" action={can('profissionais','write')?<button className="btn btn-primary" onClick={novo}>Novo profissional</button>:null}/>
    <ErrorBox error={error}/>
    {success&&<div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}

    <div className="card p-4 mb-4 grid md:grid-cols-2 gap-3">
      <label><span className="label">Buscar profissional</span><input className="input" placeholder="Nome, função, especialidade ou registro" value={q} onChange={e=>setQ(e.target.value)}/></label>
      <label><span className="label">Departamento</span><select className="input" value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}><option value="">Todos</option>{deps.map(d=><option key={d.id} value={d.id}>{d.nome}</option>)}</select></label>
    </div>

    <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Nome</th><th>Registro</th><th>Função</th><th>Departamento</th><th>Acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {filtered.map(p=>{
        const ind=p.indisponibilidades?.[0];
        const temporary=ind&&!ind.indeterminado&&(!ind.fim||new Date(ind.fim)>=new Date());
        return <tr key={p.id}>
          <td className="font-semibold">{p.nome}</td>
          <td>{p.registroConselho}</td>
          <td>{p.cargo}</td>
          <td>{p.departamentoPrincipal?.nome||<span className="text-amber-700">Não definido</span>}</td>
          <td>{p.usuario?<span className={p.usuario.ativo?'text-blue-700 font-semibold':'text-slate-400'}>{p.usuario.username}{p.usuario.ativo?'':' (desativado)'}</span>:'—'}</td>
          <td>{!p.ativo?<span className="text-slate-500 font-semibold">Inativo</span>:temporary?<span className="text-amber-700 font-semibold">Afastado até {fmtDate(ind.fim)}</span>:<span className="text-green-700 font-semibold">Ativo</span>}</td>
          <td><div className="flex gap-2 flex-wrap">
            {can('profissionais','write')&&<button className="text-blue-700 font-semibold text-sm" onClick={()=>editar(p)}>Editar</button>}
            {p.ativo&&can('profissionais','delete')&&<button className="text-red-700 font-semibold text-sm" onClick={()=>abrirInativacao(p)}>Afastar / Inativar</button>}
            {!p.ativo&&can('profissionais','write')&&<button className="text-green-700 font-semibold text-sm" onClick={()=>reativar(p)}>Reativar</button>}
          </div></td>
        </tr>;
      })}
      {!filtered.length&&<tr><td colSpan="7" className="text-center text-slate-500 py-8">Nenhum profissional encontrado.</td></tr>}
    </tbody></table></div>

    <Modal open={open} title={editing?'Editar profissional':'Novo profissional'} onClose={()=>setOpen(false)}>
      <form onSubmit={save} className="grid gap-4">
        <div className="grid md:grid-cols-2 gap-3">
          <label><span className="label">Nome</span><input className="input" required value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label>
          <label><span className="label">Registro no conselho / matrícula</span><input className="input" required value={form.registroConselho} onChange={e=>setForm({...form,registroConselho:e.target.value})}/></label>
          <label><span className="label">Categoria profissional</span><select className="input" value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value,especialidade:e.target.value==='MÉDICO'?form.especialidade:''})}>{categorias.map(c=><option key={c}>{c}</option>)}</select></label>
          <label><span className="label">Especialidade / área</span><input className="input" list="especialidades-medicas" placeholder={form.categoria==='MÉDICO'?'Comece a digitar: pediatria, ortopedia...':'Opcional'} value={form.especialidade} onChange={e=>setForm({...form,especialidade:e.target.value})}/><datalist id="especialidades-medicas">{especialidades.map(s=><option key={s} value={s}/>)}</datalist></label>
          <label className="md:col-span-2"><span className="label">Departamento principal</span><select className="input" required value={form.departamentoPrincipalId} onChange={e=>setForm({...form,departamentoPrincipalId:e.target.value})}><option value="">Selecione</option>{deps.map(d=><option key={d.id} value={d.id}>{d.nome}</option>)}</select></label>
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
    </Modal>

    <Modal open={!!absence} title="Afastar / inativar profissional" onClose={()=>{setAbsence(null);setImpact(null)}}>
      {absence&&<form onSubmit={confirmarInativacao} className="grid gap-4">
        <div className="rounded-lg bg-slate-50 p-3"><b>{absence.profissional.nome}</b><div className="text-sm text-slate-500">{absence.profissional.cargo}</div></div>
        <div className="rounded-lg border p-3 text-sm">
          <div><b>{impact?.escalasFuturas??'—'}</b> plantão(ões) de hoje em diante.</div>
          {absence.modo==='TEMPORARIA'&&<div className="mt-1 text-amber-700"><b>{impact?.escalasPeriodo??'—'}</b> plantão(ões) dentro do afastamento selecionado serão removidos.</div>}
          {absence.modo==='INDETERMINADA'&&<div className="mt-1 text-red-700">Todos os plantões futuros serão removidos.</div>}
        </div>
        <label className="flex gap-2 items-start"><input type="radio" name="modo" checked={absence.modo==='TEMPORARIA'} onChange={()=>changeAbsence({...absence,modo:'TEMPORARIA'})}/><span><b>Afastamento temporário</b><span className="block text-sm text-slate-500">O profissional continua cadastrado como ativo, mas não poderá ser escalado no período.</span></span></label>
        {absence.modo==='TEMPORARIA'&&<label><span className="label">Quantidade de dias</span><input className="input" type="number" min="1" max="365" required value={absence.dias} onChange={e=>changeAbsence({...absence,dias:Number(e.target.value)})}/></label>}
        <label className="flex gap-2 items-start"><input type="radio" name="modo" checked={absence.modo==='INDETERMINADA'} onChange={()=>changeAbsence({...absence,modo:'INDETERMINADA'})}/><span><b>Inativação por tempo indeterminado</b><span className="block text-sm text-slate-500">O profissional será marcado como inativo e toda a escala futura será removida.</span></span></label>
        <label><span className="label">Motivo / observação</span><textarea className="input" value={absence.motivo} onChange={e=>setAbsence({...absence,motivo:e.target.value})}/></label>
        <button className="btn btn-primary">{absence.modo==='TEMPORARIA'?'Confirmar afastamento':'Confirmar inativação'}</button>
      </form>}
    </Modal>
  </>;
}
