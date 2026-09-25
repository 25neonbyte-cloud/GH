import { useEffect,useMemo,useState } from 'react';
import { api,errMsg } from '../services/api';
import { ErrorBox,PageTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import ClinicalForm from '../components/clinical/ClinicalForm';
import ClinicalTimeline from '../components/clinical/ClinicalTimeline';
import {
  emptyClinicalForm,
  fmtBrasilia,
  inheritedClinicalForm,
  measurementLabels,
  measurementPlaceholders,
  measurementUnits,
  measurementValue,
} from '../utils/clinical';

const emptyMeasurements={pa:'',fc:'',fr:'',temp:'',spo2:'',glicemia:''};

export default function Prontuario(){
  const {can,user}=useAuth();
  const [patients,setPatients]=useState([]);
  const [pid,setPid]=useState('');
  const [templates,setTemplates]=useState([]);
  const [templateId,setTemplateId]=useState('');
  const [context,setContext]=useState(null);
  const [timeline,setTimeline]=useState([]);
  const [content,setContent]=useState({});
  const [measurements,setMeasurements]=useState(emptyMeasurements);
  const [inherited,setInherited]=useState([]);
  const [originId,setOriginId]=useState(null);
  const [problem,setProblem]=useState('');
  const [filter,setFilter]=useState('TODOS');
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  useEffect(()=>{
    Promise.all([api.get('/pacientes'),api.get('/prontuario/templates/minha')])
      .then(([p,t])=>{
        setPatients(Array.isArray(p.data?.data)?p.data.data:[]);
        const list=Array.isArray(t.data?.data)?t.data.data:[];
        setTemplates(list);
        if(list.length===1)setTemplateId(list[0].id);
      })
      .catch(e=>setError(errMsg(e)));
  },[]);

  const loadClinical=async({prefill=true}={})=>{
    if(!pid){setContext(null);setTimeline([]);return;}
    try{
      const params=templateId?{templateId}:{};
      const [ctx,tl]=await Promise.all([
        api.get('/prontuario/paciente/'+pid+'/contexto',{params}),
        api.get('/prontuario/paciente/'+pid+'/timeline'),
      ]);
      setContext(ctx.data);
      setTimeline(Array.isArray(tl.data?.data)?tl.data.data:[]);
      if(!templateId&&ctx.data?.template?.id)setTemplateId(ctx.data.template.id);

      if(prefill&&ctx.data?.template){
        const inheritedData=inheritedClinicalForm(ctx.data.template,ctx.data.ultimaEvolucao);
        setContent(inheritedData.values);
        setInherited(inheritedData.inherited);
        setOriginId(inheritedData.inherited.length?ctx.data.ultimaEvolucao?.id:null);
      }else if(ctx.data?.template){
        setContent(emptyClinicalForm(ctx.data.template));
        setInherited([]);
        setOriginId(null);
      }
      setError('');
    }catch(e){setError(errMsg(e));}
  };

  useEffect(()=>{if(pid)loadClinical({prefill:true});},[pid,templateId]);

  const changeField=(key,value)=>{
    setContent(current=>({...current,[key]:value}));
    setInherited(current=>current.filter(item=>item!==key));
  };

  const save=async e=>{
    e.preventDefault();
    try{
      setError('');
      await api.post('/prontuario/paciente/'+pid,{
        templateId:context?.template?.id,
        conteudo:content,
        medicoesClinicas:measurements,
        evolucaoOrigemId:originId,
        camposHerdados:inherited,
      });
      setSuccess('Evolução registrada com autoria, horário e vínculo clínico.');
      setMeasurements(emptyMeasurements);
      await loadClinical({prefill:false});
    }catch(e){setError(errMsg(e));}
  };

  const addProblem=async e=>{
    e.preventDefault();
    try{
      await api.post('/prontuario/paciente/'+pid+'/problemas',{descricao:problem});
      setProblem('');
      setSuccess('Problema clínico incluído na linha do tempo.');
      await loadClinical({prefill:false});
    }catch(e){setError(errMsg(e));}
  };

  const confirmProblem=async id=>{
    try{
      await api.post('/prontuario/problemas/'+id+'/confirmar',{});
      setSuccess('Problema clínico confirmado com autoria e horário.');
      await loadClinical({prefill:false});
    }catch(e){setError(errMsg(e));}
  };

  const resolveProblem=async id=>{
    if(!window.confirm('Marcar este problema como resolvido?'))return;
    try{
      await api.post('/prontuario/problemas/'+id+'/status',{status:'RESOLVIDO'});
      setSuccess('Problema clínico marcado como resolvido.');
      await loadClinical({prefill:false});
    }catch(e){setError(errMsg(e));}
  };

  const filteredTimeline=useMemo(()=>{
    if(filter==='TODOS')return timeline;
    if(filter==='PROBLEMAS')return timeline.filter(x=>x.tipoEvento==='PROBLEMA');
    return timeline.filter(x=>{
      if(x.tipoEvento!=='EVOLUCAO')return false;
      const category=x.item?.template?.categoriaProfissional;
      if(category)return category===filter;
      if(filter==='MEDICA')return x.item?.tipo==='MEDICA';
      if(filter==='ENFERMAGEM')return x.item?.tipo==='ENFERMAGEM';
      return filter==='MULTIPROFISSIONAL'&&x.item?.tipo==='MULTIPROFISSIONAL';
    });
  },[timeline,filter]);

  const latest=Object.values(context?.ultimasMedicoes||{});
  const filterOptions=[
    ['TODOS','Todos'],
    ['MEDICA','Médica'],
    ['ENFERMAGEM','Enfermagem'],
    ['FISIOTERAPIA','Fisioterapia'],
    ['MULTIPROFISSIONAL','Multiprofissional'],
    ['PROBLEMAS','Problemas'],
  ];

  return <><PageTitle title="Prontuário eletrônico" subtitle="Evolução modular, dados estruturados e linha do tempo clínica"/>
    <ErrorBox error={error}/>
    {success&&<div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}

    <div className="card p-4 mb-4 grid lg:grid-cols-3 gap-3">
      <label className="lg:col-span-2"><span className="label">Paciente</span><select className="input" value={pid} onChange={e=>{setPid(e.target.value);setSuccess('')}}><option value="">Selecione o paciente</option>{patients.map(p=><option key={p.id} value={p.id}>{p.prontuario} — {p.nome}</option>)}</select></label>
      {templates.length>1&&<label><span className="label">Ficha profissional</span><select className="input" value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">Automática pelo perfil</option>{templates.map(t=><option key={t.id} value={t.id}>{t.nome} · v{t.versao}</option>)}</select></label>}
    </div>

    {pid&&context&&<>
      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <div className="card p-4"><div className="text-xs text-slate-500">Paciente</div><b>{context.paciente?.nome}</b><div className="text-xs mt-1">Prontuário {context.paciente?.prontuario}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Internação atual</div><b>{context.internacao?'Leito '+context.internacao.leito?.numero:'Sem internação ativa'}</b></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Ficha ativa</div><b>{context.template?.nome}</b><div className="text-xs mt-1">versão {context.template?.versao}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Profissional logado</div><b>{context.profissional?.nome||user?.nome}</b><div className="text-xs mt-1">{context.profissional?.cargo||user?.cargo||'—'}</div></div>
      </div>

      {context.ultimaEvolucao&&<div className="card p-4 mb-4 bg-slate-50">
        <div className="text-xs text-slate-500">Última evolução desta categoria</div>
        <div className="flex flex-wrap justify-between gap-2 mt-1"><b>{context.ultimaEvolucao.profissional?.nome||context.ultimaEvolucao.criadoPorNome}</b><span className="text-sm">{fmtBrasilia(context.ultimaEvolucao.createdAt)}</span></div>
        {!!inherited.length&&<div className="text-sm text-amber-700 mt-2"><b>* {inherited.length} campo(s) pré-preenchido(s)</b> a partir dessa evolução. Revise cada valor; ao alterar um campo, a marca de herança é removida. Os que permanecerem serão registrados como confirmados.</div>}
      </div>}

      {!!latest.length&&<div className="card p-4 mb-4">
        <h2 className="font-bold mb-3">Últimas medições registradas</h2>
        <div className="flex flex-wrap gap-2">{latest.map(m=><div key={m.id} className="bg-slate-50 rounded-lg px-3 py-2 text-sm"><div className="text-xs text-slate-500">{measurementLabels[m.codigo]||m.codigo}</div><b>{measurementValue(m)}</b><div className="text-[11px] text-slate-400">{fmtBrasilia(m.observadoEm)}</div></div>)}</div>
      </div>}

      <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-4 mb-5">
        {can('prontuario','write')&&<form onSubmit={save} className="card p-4">
          <div className="flex justify-between gap-3 items-start mb-4"><div><h2 className="font-bold text-lg">Nova {context.template?.nome?.toLowerCase()}</h2><p className="text-xs text-slate-500">Horário armazenado em UTC e exibido em horário de Brasília.</p></div><span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-1">Autoria automática</span></div>

          <div className="border rounded-xl p-4 mb-4">
            <h3 className="font-bold mb-3">Sinais vitais / medições</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Object.keys(emptyMeasurements).map(key=><label key={key}><span className="label">{measurementLabels[key]} <span className="text-slate-400 font-normal">({measurementUnits[key]})</span></span><input className="input" inputMode={key==='pa'?'text':'decimal'} placeholder={measurementPlaceholders[key]} value={measurements[key]} onChange={e=>setMeasurements({...measurements,[key]:e.target.value})}/></label>)}</div>
          </div>

          <ClinicalForm template={context.template} values={content} inherited={inherited} onChange={changeField}/>
          <button className="btn btn-primary w-full mt-4">Registrar evolução</button>
        </form>}

        <div className="card p-4">
          <h2 className="font-bold text-lg mb-1">Problemas e diagnósticos ativos</h2>
          <p className="text-xs text-slate-500 mb-4">Cada criação, confirmação e resolução gera um evento com profissional e horário.</p>
          {can('prontuario','write')&&<form onSubmit={addProblem} className="flex gap-2 mb-4"><input className="input" required minLength="3" placeholder="Novo problema ou diagnóstico" value={problem} onChange={e=>setProblem(e.target.value)}/><button className="btn btn-primary">Adicionar</button></form>}
          <div className="space-y-3">{context.problemas?.map(p=><div key={p.id} className="border rounded-lg p-3">
            <div className="font-semibold">{p.descricao}</div>
            <div className="text-xs text-slate-500 mt-1">Desde {fmtBrasilia(p.iniciadoEm)}{p.criadoPorProfissional?.nome?' · '+p.criadoPorProfissional.nome:''}</div>
            {p.eventos?.[0]&&<div className="text-xs text-slate-500 mt-1">Último evento: {p.eventos[0].tipo} · {fmtBrasilia(p.eventos[0].ocorridoEm)}{p.eventos[0].profissional?.nome?' · '+p.eventos[0].profissional.nome:''}</div>}
            {can('prontuario','write')&&<div className="flex gap-2 mt-3"><button type="button" className="btn btn-secondary text-xs" onClick={()=>confirmProblem(p.id)}>Confirmar quadro</button><button type="button" className="btn btn-secondary text-xs" onClick={()=>resolveProblem(p.id)}>Resolver</button></div>}
          </div>)}{!context.problemas?.length&&<div className="text-sm text-slate-500 py-6 text-center">Nenhum problema ativo.</div>}</div>
        </div>
      </div>

      <div className="mb-3 flex gap-2 flex-wrap">{filterOptions.map(([key,label])=><button key={key} className={'btn '+(filter===key?'btn-primary':'btn-secondary')} onClick={()=>setFilter(key)}>{label}</button>)}</div>
      <ClinicalTimeline timeline={filteredTimeline}/>
    </>}
  </>;
}
