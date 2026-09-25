import { useEffect,useMemo,useState } from 'react';
import { api,errMsg } from '../services/api';
import { ErrorBox,Modal,PageTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';

const turnos=['MANHA','TARDE','NOITE'];
const turnoLabel={MANHA:'Manhã',TARDE:'Tarde',NOITE:'Noite'};
const dateKey=v=>String(v||'').slice(0,10);
const parseIso=iso=>{const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d,12)};
const isoLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays=(iso,n)=>{const d=parseIso(iso);d.setDate(d.getDate()+n);return isoLocal(d)};
const mondayOf=iso=>{const d=parseIso(iso);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return isoLocal(d)};
const todayIso=()=>isoLocal(new Date());
const dayLabel=iso=>parseIso(iso).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'});
const fullDayLabel=iso=>parseIso(iso).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
const periodLabel=start=>`${parseIso(start).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} — ${parseIso(addDays(start,6)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}`;

function monthRange(reference){
  const d=parseIso(reference);
  const first=new Date(d.getFullYear(),d.getMonth(),1,12);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0,12);
  return [isoLocal(first),isoLocal(last)];
}

export default function Escala(){
  const {can}=useAuth();
  const [weekStart,setWeekStart]=useState(mondayOf(todayIso()));
  const [list,setList]=useState([]),[pros,setPros]=useState([]),[deps,setDeps]=useState([]);
  const [q,setQ]=useState(''),[cargo,setCargo]=useState(''),[departamentoId,setDepartamentoId]=useState(''),[profissionalId,setProfissionalId]=useState('');
  const [view,setView]=useState('cards');
  const [form,setForm]=useState({profissionalId:'',departamentoId:'',data:'',turno:'MANHA',repeticoes:1});
  const [edit,setEdit]=useState(null),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const [alerts,setAlerts]=useState([]),[alertOpen,setAlertOpen]=useState(null);
  const [exportRange,setExportRange]=useState('SEMANA');

  const load=async()=>{try{
    const requests=[
      api.get('/escala',{params:{dataInicio:weekStart,dataFim:addDays(weekStart,6)}}),
      api.get('/profissionais'),
      api.get('/departamentos'),
    ];
    if(can('escala','write'))requests.push(api.get('/escala/alertas'));
    const [a,b,d,al]=await Promise.all(requests);
    setList(Array.isArray(a.data?.data)?a.data.data:[]);
    setPros(Array.isArray(b.data?.data)?b.data.data:[]);
    setDeps(Array.isArray(d.data?.data)?d.data.data:[]);
    if(al){
      const unread=Array.isArray(al.data?.data)?al.data.data:[];
      setAlerts(unread);
      if(!alertOpen&&unread.length)setAlertOpen(unread[0]);
    }
    setError('');
  }catch(e){setError(errMsg(e));}};
  useEffect(()=>{load()},[weekStart]);

  const activePros=useMemo(()=>pros.filter(p=>p.ativo),[pros]);
  const categorias=useMemo(()=>[...new Set(pros.map(p=>String(p.cargo||'').split('|')[0].trim()).filter(Boolean))].sort(),[pros]);
  const selectedPro=useMemo(()=>pros.find(p=>p.id===profissionalId)||null,[pros,profissionalId]);

  const filtered=useMemo(()=>{
    const t=q.trim().toLowerCase();
    return list.filter(x=>{
      const p=x.profissional||{};
      const cat=String(p.cargo||'').split('|')[0].trim();
      return(!cargo||cat===cargo)
        &&(!departamentoId||x.departamentoId===departamentoId)
        &&(!profissionalId||x.profissionalId===profissionalId)
        &&(!t||[p.nome,p.cargo,p.registroConselho,x.departamento?.nome].filter(Boolean).some(v=>String(v).toLowerCase().includes(t)));
    });
  },[list,q,cargo,departamentoId,profissionalId]);

  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const filterActive=!!(q.trim()||cargo||departamentoId||profissionalId);

  const save=async e=>{e.preventDefault();try{
    const count=Number(form.repeticoes||1);
    if(count>1){
      const datas=Array.from({length:count},(_,i)=>addDays(form.data,i*7));
      const resp=await api.post('/escala/lote',{profissionalId:form.profissionalId,departamentoId:form.departamentoId,turno:form.turno,datas});
      const unavailable=resp.data?.indisponiveis?.length||0;
      setSuccess(`${resp.data?.criados?.length||0} plantão(ões) incluído(s)${resp.data?.ignorados?.length?'; '+resp.data.ignorados.length+' repetido(s) ignorado(s)':''}${unavailable?'; '+unavailable+' data(s) bloqueada(s) por afastamento':''}.`);
    }else{
      await api.post('/escala',{profissionalId:form.profissionalId,departamentoId:form.departamentoId,data:form.data,turno:form.turno});
      setSuccess('Plantão incluído na escala.');
    }
    setForm({...form,data:'',repeticoes:1});await load();
  }catch(e){setError(errMsg(e))}};

  const selectFormProfessional=id=>{
    const p=activePros.find(x=>x.id===id);
    setForm({...form,profissionalId:id,departamentoId:p?.departamentoPrincipalId||''});
  };

  const saveEdit=async e=>{e.preventDefault();try{
    await api.put('/escala/'+edit.id,{profissionalId:edit.profissionalId,departamentoId:edit.departamentoId,data:edit.data,turno:edit.turno});
    setEdit(null);setSuccess('Plantão alterado.');await load();
  }catch(e){setError(errMsg(e))}};

  const remove=async x=>{
    if(!window.confirm(`Remover ${x.profissional?.nome} de ${dayLabel(dateKey(x.data))} - ${turnoLabel[x.turno]}?`))return;
    try{await api.delete('/escala/'+x.id);setSuccess('Plantão removido.');await load()}catch(e){setError(errMsg(e))}
  };

  const jumpMonth=e=>{const v=e.target.value;if(v)setWeekStart(mondayOf(v+'-01'))};

  const exportDates=()=>{
    if(exportRange==='SEMANA')return[weekStart,addDays(weekStart,6)];
    if(exportRange==='QUINZENA')return[weekStart,addDays(weekStart,14)];
    return monthRange(weekStart);
  };

  const exportar=async formato=>{
    if(!profissionalId)return;
    try{
      const [dataInicio,dataFim]=exportDates();
      const response=await api.get('/escala/exportar',{
        params:{profissionalId,dataInicio,dataFim,departamentoId:departamentoId||undefined,formato},
        responseType:'blob',
      });
      const url=URL.createObjectURL(response.data);
      const a=document.createElement('a');
      const disposition=response.headers?.['content-disposition']||'';
      const match=disposition.match(/filename="?([^"]+)"?/i);
      a.href=url;a.download=match?.[1]||('escala.'+formato);a.click();
      URL.revokeObjectURL(url);
    }catch(e){setError(errMsg(e))}
  };

  const dismissAlert=async()=>{
    if(!alertOpen)return;
    try{await api.post('/escala/alertas/'+alertOpen.id+'/lido');}catch{}
    const rest=alerts.filter(x=>x.id!==alertOpen.id);
    setAlerts(rest);setAlertOpen(rest[0]||null);
  };

  const openEdit=x=>setEdit({
    id:x.id,profissionalId:x.profissionalId,departamentoId:x.departamentoId||x.profissional?.departamentoPrincipalId||'',
    data:dateKey(x.data),turno:x.turno,currentProfessional:x.profissional,
  });

  return <><PageTitle title="Escala" subtitle="Conferência por turno, departamento e profissional, com exportação individual"/>
    <ErrorBox error={error}/>
    {success&&<div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}

    <div className="card p-4 mb-4">
      <div className="flex flex-col xl:flex-row xl:items-end gap-3 justify-between">
        <div>
          <div className="label">Semana exibida</div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn btn-secondary" onClick={()=>setWeekStart(addDays(weekStart,-7))}>← Semana anterior</button>
            <div className="px-4 py-2 font-bold min-w-48 text-center">{periodLabel(weekStart)}</div>
            <button className="btn btn-secondary" onClick={()=>setWeekStart(addDays(weekStart,7))}>Próxima semana →</button>
            <button className="btn btn-secondary" onClick={()=>setWeekStart(mondayOf(todayIso()))}>Hoje</button>
          </div>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label><span className="label">Ir para mês</span><input type="month" className="input" value={weekStart.slice(0,7)} onChange={jumpMonth}/></label>
          <div><span className="label">Visualização</span><div className="flex"><button className={'btn rounded-r-none '+(view==='cards'?'btn-primary':'btn-secondary')} onClick={()=>setView('cards')}>▦ Cards</button><button className={'btn rounded-l-none '+(view==='linhas'?'btn-primary':'btn-secondary')} onClick={()=>setView('linhas')}>☰ Linhas</button></div></div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4 pt-4 border-t">
        <label><span className="label">Busca livre</span><input className="input" placeholder="Nome, função, registro ou departamento" value={q} onChange={e=>setQ(e.target.value)}/></label>
        <label><span className="label">Profissional específico</span><select className="input" value={profissionalId} onChange={e=>setProfissionalId(e.target.value)}><option value="">Todos</option>{pros.map(p=><option key={p.id} value={p.id}>{p.nome}{p.ativo?'':' — INATIVO'}</option>)}</select></label>
        <label><span className="label">Categoria</span><select className="input" value={cargo} onChange={e=>setCargo(e.target.value)}><option value="">Todas</option>{categorias.map(c=><option key={c}>{c}</option>)}</select></label>
        <label><span className="label">Departamento</span><select className="input" value={departamentoId} onChange={e=>setDepartamentoId(e.target.value)}><option value="">Todos</option>{deps.map(d=><option key={d.id} value={d.id}>{d.nome}</option>)}</select></label>
      </div>

      {filterActive&&<div className="mt-3 text-sm bg-blue-50 text-blue-800 rounded-lg px-3 py-2">Filtro ativo: {[q.trim(),selectedPro?.nome,cargo,deps.find(d=>d.id===departamentoId)?.nome].filter(Boolean).join(' · ')}</div>}

      {selectedPro&&<div className="mt-4 p-4 border rounded-xl bg-slate-50">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
          <div><div className="text-xs text-slate-500">Exportar escala de</div><b>{selectedPro.nome}</b><div className="text-xs text-slate-500">{selectedPro.cargo} · {selectedPro.departamentoPrincipal?.nome||'Sem departamento principal'}</div></div>
          <div className="flex gap-2 flex-wrap items-end">
            <label><span className="label">Período</span><select className="input" value={exportRange} onChange={e=>setExportRange(e.target.value)}><option value="SEMANA">Semana</option><option value="QUINZENA">15 dias</option><option value="MES">Mês</option></select></label>
            <button className="btn btn-secondary" onClick={()=>exportar('xlsx')}>Exportar Excel</button>
            <button className="btn btn-primary" onClick={()=>exportar('pdf')}>Exportar PDF</button>
          </div>
        </div>
      </div>}

      {can('escala','write')&&<form onSubmit={save} className="grid md:grid-cols-2 xl:grid-cols-5 gap-3 mt-5 pt-5 border-t">
        <label className="xl:col-span-2"><span className="label">Profissional ativo</span><select className="input" required value={form.profissionalId} onChange={e=>selectFormProfessional(e.target.value)}><option value="">Selecione</option>{activePros.map(p=><option key={p.id} value={p.id}>{p.nome} — {p.cargo}</option>)}</select></label>
        <label><span className="label">Departamento do plantão</span><select className="input" required value={form.departamentoId} onChange={e=>setForm({...form,departamentoId:e.target.value})}><option value="">Selecione</option>{deps.map(d=><option key={d.id} value={d.id}>{d.nome}</option>)}</select></label>
        <label><span className="label">Data</span><input className="input" type="date" required value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></label>
        <label><span className="label">Turno</span><select className="input" value={form.turno} onChange={e=>setForm({...form,turno:e.target.value})}>{turnos.map(t=><option key={t} value={t}>{turnoLabel[t]}</option>)}</select></label>
        <label><span className="label">Repetir semanalmente</span><select className="input" value={form.repeticoes} onChange={e=>setForm({...form,repeticoes:Number(e.target.value)})}><option value="1">Não repetir</option><option value="2">2 semanas</option><option value="4">4 semanas</option><option value="5">5 semanas</option></select></label>
        <button className="btn btn-primary md:col-span-2 xl:col-span-5">Adicionar à escala</button>
      </form>}
    </div>

    {view==='cards'?<div className="card overflow-x-auto">
      <div className="min-w-[1200px]">
        <div className="grid grid-cols-[110px_repeat(7,minmax(150px,1fr))] bg-slate-50 border-b">
          <div className="p-3 font-bold">Turno</div>{days.map(d=><div key={d} className="p-3 font-bold capitalize border-l">{dayLabel(d)}</div>)}
        </div>
        {turnos.map(t=><div key={t} className="grid grid-cols-[110px_repeat(7,minmax(150px,1fr))] border-b last:border-b-0">
          <div className="p-3 font-bold text-slate-600 bg-slate-50">{turnoLabel[t]}</div>
          {days.map(day=>{const items=filtered.filter(x=>dateKey(x.data)===day&&x.turno===t);return <div key={day} className="p-2 border-l min-h-36">
            <div className="text-xs text-slate-400 mb-2">{items.length} profissional(is)</div>
            <div className="space-y-2">{items.map(x=><div className="border rounded-lg p-2 bg-white" key={x.id}>
              <div className="font-semibold text-xs">{x.profissional?.nome}</div>
              <div className="text-[11px] text-slate-500">{x.profissional?.cargo}</div>
              <div className="text-[11px] text-blue-700 mt-1">{x.departamento?.nome||x.profissional?.departamentoPrincipal?.nome||'Departamento não definido'}</div>
              {x.profissional?.ativo===false&&<div className="text-[10px] font-bold text-amber-700 mt-1">PROFISSIONAL INATIVO</div>}
              <div className="flex gap-2 mt-2">{can('escala','write')&&<button className="text-xs font-semibold text-blue-700" onClick={()=>openEdit(x)}>Editar</button>}{can('escala','delete')&&<button className="text-xs font-semibold text-red-700" onClick={()=>remove(x)}>Remover</button>}</div>
            </div>)}</div>
            {!items.length&&<div className="text-xs text-slate-400">{filterActive?'Nenhum profissional corresponde ao filtro neste turno.':'Nenhum profissional neste turno.'}</div>}
          </div>})}
        </div>)}
      </div>
    </div>:<div className="card overflow-x-auto"><table className="table"><thead><tr><th>Data</th><th>Turno</th><th>Profissional</th><th>Função</th><th>Departamento</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {filtered.map(x=><tr key={x.id}><td><b>{fullDayLabel(dateKey(x.data))}</b></td><td>{turnoLabel[x.turno]}</td><td>{x.profissional?.nome}</td><td>{x.profissional?.cargo}</td><td>{x.departamento?.nome||x.profissional?.departamentoPrincipal?.nome||'—'}</td><td>{x.profissional?.ativo===false?<span className="text-amber-700 font-semibold">Inativo</span>:<span className="text-green-700">Ativo</span>}</td><td><div className="flex gap-2">{can('escala','write')&&<button className="text-blue-700 font-semibold text-sm" onClick={()=>openEdit(x)}>Editar</button>}{can('escala','delete')&&<button className="text-red-700 font-semibold text-sm" onClick={()=>remove(x)}>Remover</button>}</div></td></tr>)}
      {!filtered.length&&<tr><td colSpan="7" className="text-center text-slate-500 py-8">Nenhum plantão encontrado.</td></tr>}
    </tbody></table></div>}

    <Modal open={!!edit} title="Editar plantão" onClose={()=>setEdit(null)}>{edit&&<form onSubmit={saveEdit} className="grid gap-3">
      <label><span className="label">Profissional</span><select className="input" value={edit.profissionalId} onChange={e=>{const p=activePros.find(x=>x.id===e.target.value);setEdit({...edit,profissionalId:e.target.value,departamentoId:p?.departamentoPrincipalId||edit.departamentoId})}}>{edit.currentProfessional&&!activePros.some(p=>p.id===edit.currentProfessional.id)&&<option value={edit.currentProfessional.id}>{edit.currentProfessional.nome} — INATIVO</option>}{activePros.map(p=><option key={p.id} value={p.id}>{p.nome} — {p.cargo}</option>)}</select></label>
      <label><span className="label">Departamento</span><select className="input" required value={edit.departamentoId} onChange={e=>setEdit({...edit,departamentoId:e.target.value})}><option value="">Selecione</option>{deps.map(d=><option key={d.id} value={d.id}>{d.nome}</option>)}</select></label>
      <div className="grid md:grid-cols-2 gap-3"><label><span className="label">Data</span><input type="date" className="input" value={edit.data} onChange={e=>setEdit({...edit,data:e.target.value})}/></label><label><span className="label">Turno</span><select className="input" value={edit.turno} onChange={e=>setEdit({...edit,turno:e.target.value})}>{turnos.map(t=><option key={t} value={t}>{turnoLabel[t]}</option>)}</select></label></div>
      <button className="btn btn-primary">Salvar alteração</button>
    </form>}</Modal>

    <Modal open={!!alertOpen} title="⚠ Alteração urgente de disponibilidade" onClose={dismissAlert}>
      {alertOpen&&<div className="space-y-4">
        <div><b>{alertOpen.titulo}</b><p className="text-sm mt-2">{alertOpen.mensagem}</p></div>
        {!!alertOpen.detalhes?.plantões?.length&&<div><div className="label">Plantões removidos</div><div className="max-h-64 overflow-auto border rounded-lg divide-y">{alertOpen.detalhes.plantões.map((x,i)=><div key={i} className="p-2 text-sm"><b>{fullDayLabel(dateKey(x.data))}</b> · {turnoLabel[x.turno]||x.turno}<div className="text-xs text-slate-500">{x.departamento||'Departamento não informado'}</div></div>)}</div></div>}
        <div className="flex justify-end"><button className="btn btn-primary" onClick={dismissAlert}>Ciente</button></div>
      </div>}
    </Modal>
  </>;
}
