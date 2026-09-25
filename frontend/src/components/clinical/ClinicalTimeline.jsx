import { useState } from 'react';
import { Modal } from '../Common';
import { evolutionLabel, fmtBrasilia, measurementLabels, measurementValue } from '../../utils/clinical';

function templateData(e) {
  const fields=e.template?.schema?.fields||[];
  const labels=new Map(fields.map(field=>[field.key,field.label]));
  const content=e.conteudo||{};
  const orderedKeys=[
    ...fields.map(field=>field.key).filter(key=>Object.prototype.hasOwnProperty.call(content,key)),
    ...Object.keys(content).filter(key=>!labels.has(key)),
  ];
  const values=orderedKeys
    .map(key=>({key,label:labels.get(key)||key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()),value:content[key]}))
    .filter(item=>item.value!==null&&item.value!==undefined&&item.value!=='');
  return {fields,labels,content,values};
}

function VitalChips({evolution,compact=false}) {
  const structured=evolution.medicoesClinicas||[];
  if(structured.length) return <div className="flex flex-wrap gap-2">
    {structured.map(m=><span key={m.id} className={(compact?'text-[11px] ':'text-xs ')+'bg-slate-100 rounded-lg px-2 py-1'}><b>{measurementLabels[m.codigo]||m.codigo}:</b> {measurementValue(m)}</span>)}
  </div>;

  const legacy=evolution.sinaisVitais||{};
  const entries=Object.entries(legacy).filter(([,value])=>value!==null&&value!==undefined&&value!=='');
  if(!entries.length)return null;
  return <div className="flex flex-wrap gap-2">
    {entries.map(([key,value])=><span key={key} className={(compact?'text-[11px] ':'text-xs ')+'bg-slate-100 rounded-lg px-2 py-1'}><b>{measurementLabels[key]||key}:</b> {String(value)}</span>)}
  </div>;
}

function EvolutionDetails({evolution}) {
  const e=evolution;
  const {labels,values}=templateData(e);
  const inherited=new Set(e.camposHerdados||[]);
  const structured=!!e.templateId;

  return <div className="space-y-5">
    <div className="grid sm:grid-cols-2 gap-3 text-sm">
      <div><div className="text-slate-500">Profissional</div><b>{e.profissional?.nome||e.criadoPorNome||'—'}</b></div>
      <div><div className="text-slate-500">Cargo</div><b>{e.profissional?.cargo||e.criadoPorCargo||'—'}</b></div>
      <div><div className="text-slate-500">Registro profissional</div><b>{e.profissional?.registroConselho||'—'}</b></div>
      <div><div className="text-slate-500">Data/hora</div><b>{fmtBrasilia(e.assinadaEm||e.createdAt)}</b></div>
      <div><div className="text-slate-500">Internação</div><b>{e.internacao?'Ativa no registro':'Sem vínculo de internação'}</b></div>
      <div><div className="text-slate-500">Leito no momento do vínculo</div><b>{e.internacao?.leito?.numero||'—'}{e.internacao?.leito?.tipo?' · '+e.internacao.leito.tipo:''}</b></div>
      <div><div className="text-slate-500">Ficha</div><b>{e.template?.nome||'Registro legado'}</b></div>
      <div><div className="text-slate-500">Versão da ficha</div><b>{e.templateVersao||e.template?.versao||'—'}</b></div>
    </div>

    {(e.medicoesClinicas?.length||Object.keys(e.sinaisVitais||{}).length>0)&&<div>
      <h3 className="font-bold mb-2">Sinais vitais / medições</h3>
      <VitalChips evolution={e}/>
    </div>}

    {structured?<div>
      <h3 className="font-bold mb-3">Formulário registrado</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {values.map(item=><div key={item.key} className={'rounded-lg border p-3 '+(inherited.has(item.key)?'border-amber-200 bg-amber-50':'bg-white')}>
          <div className="text-xs text-slate-500">{item.label}{inherited.has(item.key)&&<span className="ml-2 text-amber-700 font-semibold">confirmado da evolução anterior</span>}</div>
          <div className="mt-1 font-semibold whitespace-pre-wrap break-words">{String(item.value)}</div>
        </div>)}
      </div>
      {!values.length&&<div className="text-sm text-slate-500">Nenhum campo estruturado preenchido.</div>}
    </div>:<div>
      <h3 className="font-bold mb-3">Registro legado</h3>
      <div className="grid gap-3 text-sm">
        {e.queixas&&<div><div className="text-slate-500">Queixas</div><b className="whitespace-pre-wrap">{e.queixas}</b></div>}
        {e.condutaMedica&&<div><div className="text-slate-500">Conduta</div><b className="whitespace-pre-wrap">{e.condutaMedica}</b></div>}
        {e.medicacoes&&<div><div className="text-slate-500">Medicações</div><b className="whitespace-pre-wrap">{e.medicacoes}</b></div>}
        <div><div className="text-slate-500">Observações</div><div className="whitespace-pre-wrap">{e.observacoes||'—'}</div></div>
      </div>
    </div>}

    {!!e.camposHerdados?.length&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <b>Dados herdados e confirmados:</b> {e.camposHerdados.map(key=>labels.get(key)||key).join(', ')}.
    </div>}
  </div>;
}

function EvolutionEvent({item,onOpen}) {
  const e=item.item;
  const {values,labels}=templateData(e);
  const preview=values.slice(0,3);

  return <button type="button" onClick={()=>onOpen(e)} className="card p-4 w-full text-left hover:border-blue-300 hover:shadow-md transition cursor-pointer">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
      <div>
        <div className="font-bold">{evolutionLabel(e)}</div>
        <div className="text-xs text-slate-500">{e.profissional?.nome||e.criadoPorNome} · {e.profissional?.cargo||e.criadoPorCargo}{e.profissional?.registroConselho?' · '+e.profissional.registroConselho:''}</div>
      </div>
      <div className="text-sm text-slate-500">{fmtBrasilia(item.ocorridoEm)}</div>
    </div>

    {!!(e.medicoesClinicas?.length||Object.keys(e.sinaisVitais||{}).length)&&<div className="mt-3"><VitalChips evolution={e} compact/></div>}

    {!!preview.length&&<div className="grid md:grid-cols-2 gap-x-5 gap-y-2 mt-3 text-sm">
      {preview.map(entry=><div key={entry.key}><span className="text-slate-500">{entry.label}: </span><b className="whitespace-pre-wrap">{String(entry.value)}</b></div>)}
    </div>}

    {!e.templateId&&<p className="mt-3 whitespace-pre-wrap">{e.observacoes}</p>}

    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="text-slate-500">
        {e.templateId
          ? values.length+' campo(s) registrado(s)'+(e.camposHerdados?.length?' · '+e.camposHerdados.length+' confirmado(s) da evolução anterior':'')
          : 'Registro legado · dados disponíveis preservados'}
      </div>
      <span className="font-semibold text-blue-700">Ver evolução completa →</span>
    </div>

    {!!e.camposHerdados?.length&&<div className="mt-2 text-xs text-amber-700">Confirmados da evolução anterior: {e.camposHerdados.map(key=>labels.get(key)||key).join(', ')}</div>}
  </button>;
}

function ProblemEvent({item}) {
  const e=item.item;
  return <div className="card p-4 border-l-4 border-l-amber-400">
    <div className="flex justify-between gap-3">
      <div><b>Problema clínico · {e.tipo}</b><div className="text-sm mt-1">{e.problema?.descricao}</div></div>
      <span className="text-sm text-slate-500">{fmtBrasilia(item.ocorridoEm)}</span>
    </div>
    <div className="text-xs text-slate-500 mt-2">{e.profissional?.nome||e.criadoPor}{e.profissional?.cargo ? ' · ' + e.profissional.cargo : ''}</div>
  </div>;
}

export default function ClinicalTimeline({timeline=[]}) {
  const [selected,setSelected]=useState(null);

  if(!timeline.length) return <div className="card p-8 text-center text-slate-500">Nenhum evento clínico registrado.</div>;

  return <>
    <div className="space-y-3">{timeline.map((event,index)=>event.tipoEvento==='PROBLEMA'
      ? <ProblemEvent key={event.item?.id||index} item={event}/>
      : <EvolutionEvent key={event.item?.id||index} item={event} onOpen={setSelected}/>)}</div>

    <Modal open={!!selected} title={selected?evolutionLabel(selected):'Evolução'} onClose={()=>setSelected(null)}>
      {selected&&<EvolutionDetails evolution={selected}/>}
    </Modal>
  </>;
}
