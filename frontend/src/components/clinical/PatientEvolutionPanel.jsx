import { useEffect,useMemo,useState } from 'react';
import { api,errMsg } from '../../services/api';
import { ErrorBox } from '../Common';
import { useAuth } from '../../context/AuthContext';
import ClinicalForm from './ClinicalForm';
import {
  emptyClinicalForm,fmtBrasilia,inheritedClinicalForm,
  measurementLabels,measurementPlaceholders,measurementUnits,measurementValue,
} from '../../utils/clinical';

const emptyMeasurements={pa:'',fc:'',fr:'',temp:'',spo2:'',glicemia:''};

export default function PatientEvolutionPanel({patientId,onChanged}){
  const {can}=useAuth();
  const [templates,setTemplates]=useState([]),[templateId,setTemplateId]=useState('');
  const [context,setContext]=useState(null),[content,setContent]=useState({}),[measurements,setMeasurements]=useState(emptyMeasurements);
  const [inherited,setInherited]=useState([]),[confirmedInherited,setConfirmedInherited]=useState(false),[originId,setOriginId]=useState(null);
  const [problem,setProblem]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('');

  useEffect(()=>{
    api.get('/prontuario/templates/minha').then(r=>{
      const list=(r.data?.data||[]).filter(x=>x.categoriaProfissional!=='TRIAGEM');
      setTemplates(list);
      if(list.length)setTemplateId(list[0].id);
    }).catch(e=>setError(errMsg(e)));
  },[]);

  const load=async({prefill=true,preserve=false}={})=>{
    if(!patientId||!templateId)return;
    try{
      const {data}=await api.get('/prontuario/paciente/'+patientId+'/contexto',{params:{templateId}});
      setContext(data);
      if(prefill){
        const h=inheritedClinicalForm(data.template,data.ultimaEvolucao);
        setContent(h.values);setInherited(h.inherited);setConfirmedInherited(false);
        setOriginId(h.inherited.length?data.ultimaEvolucao?.id:null);
      }else if(!preserve){
        setContent(emptyClinicalForm(data.template));setInherited([]);setConfirmedInherited(false);setOriginId(null);
      }
      setError('');
    }catch(e){setError(errMsg(e))}
  };
  useEffect(()=>{load({prefill:true})},[patientId,templateId]);

  const changeField=(key,value)=>{setContent(v=>({...v,[key]:value}));setInherited(v=>v.filter(x=>x!==key));};

  const save=async e=>{e.preventDefault();try{
    await api.post('/prontuario/paciente/'+patientId,{
      templateId:context?.template?.id,conteudo:content,medicoesClinicas:measurements,
      evolucaoOrigemId:originId,camposHerdados:inherited,confirmouHerdados:inherited.length===0||confirmedInherited,
    });
    setMeasurements(emptyMeasurements);setContent(emptyClinicalForm(context?.template));setInherited([]);setConfirmedInherited(false);setOriginId(null);
    setSuccess('Evolução registrada.');await load({prefill:false,preserve:true});onChanged?.();
  }catch(e){setError(errMsg(e))}};

  const addProblem=async e=>{e.preventDefault();try{
    await api.post('/prontuario/paciente/'+patientId+'/problemas',{descricao:problem});setProblem('');
    setSuccess('Problema clínico incluído.');await load({prefill:false,preserve:true});onChanged?.();
  }catch(e){setError(errMsg(e))}};

  const confirmProblem=async id=>{try{await api.post('/prontuario/problemas/'+id+'/confirmar',{});await load({prefill:false,preserve:true});onChanged?.()}catch(e){setError(errMsg(e))}};
  const resolveProblem=async id=>{if(!window.confirm('Marcar este problema como resolvido?'))return;try{await api.post('/prontuario/problemas/'+id+'/status',{status:'RESOLVIDO'});await load({prefill:false,preserve:true});onChanged?.()}catch(e){setError(errMsg(e))}};

  const latest=useMemo(()=>Object.values(context?.ultimasMedicoes||{}),[context]);
  if(!templateId)return <div className="card p-6 text-slate-500">Nenhuma ficha de evolução disponível para este perfil.</div>;

  return <div className="space-y-4">
    <ErrorBox error={error}/>{success&&<div className="p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}
    {templates.length>1&&<div className="card p-4"><label><span className="label">Ficha profissional</span><select className="input max-w-xl" value={templateId} onChange={e=>setTemplateId(e.target.value)}>{templates.map(t=><option key={t.id} value={t.id}>{t.nome} · v{t.versao}</option>)}</select></label></div>}
    {!!latest.length&&<div className="card p-4"><h3 className="font-bold mb-3">Últimas medições</h3><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{latest.map(m=>{const trend=(context.tendenciasMedicoes?.[m.codigo]||[]).slice().reverse();return <div key={m.id} className="bg-slate-50 rounded-lg px-3 py-2 text-sm"><div className="text-xs text-slate-500">{measurementLabels[m.codigo]||m.codigo}</div><b>{measurementValue(m)}</b><div className="text-[11px] text-slate-400">{fmtBrasilia(m.observadoEm)}</div>{trend.length>1&&<div className="text-[11px] text-slate-500 mt-2 truncate">Tendência: {trend.map(x=>x.valorTexto??x.valorNumerico).join(' → ')}</div>}</div>})}</div></div>}
    <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-4">
      {can('prontuario','write')?<form onSubmit={save} className="card p-4">
        <div className="mb-4"><h2 className="font-bold text-lg">Nova {context?.template?.nome?.toLowerCase()}</h2>{context?.ultimaEvolucao&&<div className="text-xs text-slate-500 mt-1">Última: {context.ultimaEvolucao.profissional?.nome||context.ultimaEvolucao.criadoPorNome} · {fmtBrasilia(context.ultimaEvolucao.createdAt)}</div>}</div>
        <div className="border rounded-xl p-4 mb-4"><h3 className="font-bold mb-3">Sinais vitais / medições</h3><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Object.keys(emptyMeasurements).map(key=><label key={key}><span className="label">{measurementLabels[key]} <span className="text-slate-400 font-normal">({measurementUnits[key]})</span></span><input className="input" placeholder={measurementPlaceholders[key]} value={measurements[key]} onChange={e=>setMeasurements({...measurements,[key]:e.target.value})}/></label>)}</div></div>
        <ClinicalForm template={context?.template} values={content} inherited={inherited} onChange={changeField}/>
        {!!inherited.length&&<label className="mt-4 flex gap-2 items-start rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmedInherited} onChange={e=>setConfirmedInherited(e.target.checked)}/><span>Revisei e confirmo os campos herdados desta evolução.</span></label>}
        <button className="btn btn-primary w-full mt-4" disabled={inherited.length>0&&!confirmedInherited}>Registrar evolução</button>
      </form>:<div className="card p-6 text-slate-500">Seu perfil possui acesso de leitura ao prontuário, sem permissão para registrar evolução.</div>}
      <div className="card p-4">
        <h2 className="font-bold text-lg mb-1">Problemas e diagnósticos ativos</h2>
        {can('prontuario','write')&&<form onSubmit={addProblem} className="flex gap-2 my-4"><input className="input" required minLength="3" placeholder="Novo problema ou diagnóstico" value={problem} onChange={e=>setProblem(e.target.value)}/><button className="btn btn-primary">Adicionar</button></form>}
        <div className="space-y-3">{context?.problemas?.map(p=><div key={p.id} className="border rounded-lg p-3"><b>{p.descricao}</b><div className="text-xs text-slate-500 mt-1">Desde {fmtBrasilia(p.iniciadoEm)}</div>{can('prontuario','write')&&<div className="flex gap-2 mt-3"><button type="button" className="btn btn-secondary text-xs" onClick={()=>confirmProblem(p.id)}>Confirmar quadro</button><button type="button" className="btn btn-secondary text-xs" onClick={()=>resolveProblem(p.id)}>Resolver</button></div>}</div>)}{!context?.problemas?.length&&<div className="text-sm text-slate-500 py-6 text-center">Nenhum problema ativo.</div>}</div>
      </div>
    </div>
  </div>;
}
