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
const periodLabel=start=>`${parseIso(start).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} — ${parseIso(addDays(start,6)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}`;

export default function Escala(){
  const {can}=useAuth();
  const [weekStart,setWeekStart]=useState(mondayOf(todayIso()));
  const [list,setList]=useState([]),[pros,setPros]=useState([]),[q,setQ]=useState(''),[cargo,setCargo]=useState('');
  const [form,setForm]=useState({profissionalId:'',data:'',turno:'MANHA',repeticoes:1}),[edit,setEdit]=useState(null),[error,setError]=useState(''),[success,setSuccess]=useState('');

  const load=async()=>{try{
    const [a,b]=await Promise.all([api.get('/escala',{params:{dataInicio:weekStart,dataFim:addDays(weekStart,6)}}),api.get('/profissionais',{params:{ativo:true}})]);
    setList(Array.isArray(a.data?.data)?a.data.data:[]);
    setPros(Array.isArray(b.data?.data)?b.data.data:[]);
    setError('');
  }catch(e){setError(errMsg(e));}};
  useEffect(()=>{load()},[weekStart]);

  const categorias=useMemo(()=>[...new Set(pros.map(p=>String(p.cargo||'').split('|')[0].trim()).filter(Boolean))].sort(),[pros]);
  const filtered=useMemo(()=>{const t=q.trim().toLowerCase();return list.filter(x=>{const p=x.profissional||{};const cat=String(p.cargo||'').split('|')[0].trim();return(!cargo||cat===cargo)&&(!t||[p.nome,p.cargo,p.registroConselho].filter(Boolean).some(v=>String(v).toLowerCase().includes(t)))})},[list,q,cargo]);
  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const filterActive=!!(q.trim()||cargo);

  const save=async e=>{e.preventDefault();try{
    const count=Number(form.repeticoes||1);
    if(count>1){const datas=Array.from({length:count},(_,i)=>addDays(form.data,i*7));const resp=await api.post('/escala/lote',{profissionalId:form.profissionalId,turno:form.turno,datas});setSuccess(`${resp.data?.criados?.length||0} plantão(ões) incluído(s)${resp.data?.ignorados?.length?`; ${resp.data.ignorados.length} repetido(s) ignorado(s)`:''}.`)}
    else{await api.post('/escala',{profissionalId:form.profissionalId,data:form.data,turno:form.turno});setSuccess('Plantão incluído na escala.')}
    setForm({...form,data:'',repeticoes:1});await load();
  }catch(e){setError(errMsg(e))}};

  const saveEdit=async e=>{e.preventDefault();try{await api.put(`/escala/${edit.id}`,{profissionalId:edit.profissionalId,data:edit.data,turno:edit.turno});setEdit(null);setSuccess('Plantão alterado.');await load()}catch(e){setError(errMsg(e))}};
  const remove=async x=>{if(!window.confirm(`Remover ${x.profissional?.nome} de ${dayLabel(dateKey(x.data))} - ${turnoLabel[x.turno]}?`))return;try{await api.delete(`/escala/${x.id}`);setSuccess('Plantão removido.');await load()}catch(e){setError(errMsg(e))}};

  const jumpMonth=e=>{const v=e.target.value;if(v)setWeekStart(mondayOf(`${v}-01`))};

  return <><PageTitle title="Escala" subtitle="Conferência semanal por turno, com navegação rápida e edição"/>
    <ErrorBox error={error}/>{success&&<div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}

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
        <label><span className="label">Ir para mês</span><input type="month" className="input" value={weekStart.slice(0,7)} onChange={jumpMonth}/></label>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mt-4 pt-4 border-t">
        <label><span className="label">Buscar profissional</span><input className="input" placeholder="Nome, função ou registro" value={q} onChange={e=>setQ(e.target.value)}/></label>
        <label><span className="label">Categoria</span><select className="input" value={cargo} onChange={e=>setCargo(e.target.value)}><option value="">Todas</option>{categorias.map(c=><option key={c}>{c}</option>)}</select></label>
      </div>

      {filterActive&&<div className="mt-3 text-sm bg-blue-50 text-blue-800 rounded-lg px-3 py-2">Filtro ativo: {[q.trim(),cargo].filter(Boolean).join(' · ')}</div>}

      {can('escala','write')&&<form onSubmit={save} className="grid md:grid-cols-5 gap-3 mt-5 pt-5 border-t">
        <label className="md:col-span-2"><span className="label">Profissional ativo</span><select className="input" required value={form.profissionalId} onChange={e=>setForm({...form,profissionalId:e.target.value})}><option value="">Selecione</option>{pros.map(p=><option key={p.id} value={p.id}>{p.nome} — {p.cargo}</option>)}</select></label>
        <label><span className="label">Data</span><input className="input" type="date" required value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></label>
        <label><span className="label">Turno</span><select className="input" value={form.turno} onChange={e=>setForm({...form,turno:e.target.value})}>{turnos.map(t=><option key={t} value={t}>{turnoLabel[t]}</option>)}</select></label>
        <label><span className="label">Repetir semanalmente</span><select className="input" value={form.repeticoes} onChange={e=>setForm({...form,repeticoes:Number(e.target.value)})}><option value="1">Não repetir</option><option value="2">2 semanas</option><option value="4">4 semanas</option><option value="5">5 semanas</option></select></label>
        <button className="btn btn-primary md:col-span-5">Adicionar à escala</button>
      </form>}
    </div>

    <div className="card overflow-x-auto">
      <div className="min-w-[1200px]">
        <div className="grid grid-cols-[110px_repeat(7,minmax(150px,1fr))] bg-slate-50 border-b">
          <div className="p-3 font-bold">Turno</div>{days.map(d=><div key={d} className="p-3 font-bold capitalize border-l">{dayLabel(d)}</div>)}
        </div>
        {turnos.map(t=><div key={t} className="grid grid-cols-[110px_repeat(7,minmax(150px,1fr))] border-b last:border-b-0">
          <div className="p-3 font-bold text-slate-600 bg-slate-50">{turnoLabel[t]}</div>
          {days.map(day=>{const items=filtered.filter(x=>dateKey(x.data)===day&&x.turno===t);return <div key={day} className="p-2 border-l min-h-36">
            <div className="text-xs text-slate-400 mb-2">{items.length} profissional(is)</div>
            <div className="space-y-2">{items.map(x=><div className="border rounded-lg p-2 bg-white" key={x.id}><div className="font-semibold text-xs">{x.profissional?.nome}</div><div className="text-[11px] text-slate-500">{x.profissional?.cargo}</div>{x.profissional?.ativo===false&&<div className="text-[10px] font-bold text-amber-700 mt-1">PROFISSIONAL INATIVO</div>}<div className="flex gap-2 mt-2">{can('escala','write')&&<button className="text-xs font-semibold text-blue-700" onClick={()=>setEdit({id:x.id,profissionalId:x.profissionalId,data:dateKey(x.data),turno:x.turno,currentProfessional:x.profissional})}>Editar</button>}{can('escala','delete')&&<button className="text-xs font-semibold text-red-700" onClick={()=>remove(x)}>Remover</button>}</div></div>)}</div>
            {!items.length&&<div className="text-xs text-slate-400">{filterActive?'Nenhum profissional corresponde ao filtro neste turno.':'Nenhum profissional neste turno.'}</div>}
          </div>})}
        </div>)}
      </div>
    </div>

    <Modal open={!!edit} title="Editar plantão" onClose={()=>setEdit(null)}>{edit&&<form onSubmit={saveEdit} className="grid gap-3">
      <label><span className="label">Profissional</span><select className="input" value={edit.profissionalId} onChange={e=>setEdit({...edit,profissionalId:e.target.value})}>{edit.currentProfessional&&!pros.some(p=>p.id===edit.currentProfessional.id)&&<option value={edit.currentProfessional.id}>{edit.currentProfessional.nome} — INATIVO</option>}{pros.map(p=><option key={p.id} value={p.id}>{p.nome} — {p.cargo}</option>)}</select></label>
      <div className="grid md:grid-cols-2 gap-3"><label><span className="label">Data</span><input type="date" className="input" value={edit.data} onChange={e=>setEdit({...edit,data:e.target.value})}/></label><label><span className="label">Turno</span><select className="input" value={edit.turno} onChange={e=>setEdit({...edit,turno:e.target.value})}>{turnos.map(t=><option key={t} value={t}>{turnoLabel[t]}</option>)}</select></label></div>
      <button className="btn btn-primary">Salvar alteração</button>
    </form>}</Modal>
  </>;
}
