import { evolutionLabel, fmtBrasilia, measurementLabels, measurementValue } from '../../utils/clinical';

function EvolutionEvent({item}) {
  const e=item.item;
  const content=e.conteudo||{};
  const templateFields=e.template?.schema?.fields||[];
  const labels=new Map(templateFields.map(field=>[field.key,field.label]));
  const orderedKeys=[
    ...templateFields.map(field=>field.key).filter(key=>Object.prototype.hasOwnProperty.call(content,key)),
    ...Object.keys(content).filter(key=>!labels.has(key)),
  ];
  return <div className="card p-4">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
      <div>
        <div className="font-bold">{evolutionLabel(e)}</div>
        <div className="text-xs text-slate-500">{e.profissional?.nome||e.criadoPorNome} · {e.profissional?.cargo||e.criadoPorCargo}</div>
      </div>
      <div className="text-sm text-slate-500">{fmtBrasilia(item.ocorridoEm)}</div>
    </div>
    {!!e.medicoesClinicas?.length&&<div className="flex flex-wrap gap-2 mt-3">
      {e.medicoesClinicas.map(m=><span key={m.id} className="text-xs bg-slate-100 rounded-lg px-2 py-1"><b>{measurementLabels[m.codigo]||m.codigo}:</b> {measurementValue(m)}</span>)}
    </div>}
    <div className="grid md:grid-cols-2 gap-x-5 gap-y-2 mt-3 text-sm">
      {orderedKeys.map(k=>[k,content[k]]).filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=><div key={k}><span className="text-slate-500">{labels.get(k)||k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}: </span><b className="whitespace-pre-wrap">{String(v)}</b></div>)}
    </div>
    {!Object.keys(content).length&&<p className="mt-3 whitespace-pre-wrap">{e.observacoes}</p>}
    {!!e.camposHerdados?.length&&<div className="mt-3 text-xs text-amber-700">Campos confirmados a partir da evolução anterior: {e.camposHerdados.map(key=>labels.get(key)||key).join(', ')}</div>}
  </div>;
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
  if(!timeline.length) return <div className="card p-8 text-center text-slate-500">Nenhum evento clínico registrado.</div>;
  return <div className="space-y-3">{timeline.map((event,index)=>event.tipoEvento==='PROBLEMA'
    ? <ProblemEvent key={event.item?.id||index} item={event}/>
    : <EvolutionEvent key={event.item?.id||index} item={event}/>)}</div>;
}
