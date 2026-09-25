import { useEffect,useMemo,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { api,errMsg } from '../services/api';
import { ErrorBox,PageTitle,Status } from '../components/Common';
import ClinicalTimeline from '../components/clinical/ClinicalTimeline';
import { fmtBrasilia,measurementLabels,measurementValue } from '../utils/clinical';
import { useAuth } from '../context/AuthContext';

const fmtDate=v=>v?new Date(v).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';

export default function PacienteDetalhe(){
  const {id}=useParams();
  const {can}=useAuth();
  const [data,setData]=useState(null);
  const [timeline,setTimeline]=useState([]);
  const [tab,setTab]=useState('resumo');
  const [filter,setFilter]=useState('TODOS');
  const [error,setError]=useState('');

  const load=async()=>{
    try{
      const patient=await api.get('/pacientes/'+id);
      setData(patient.data);
      setError('');
      if(can('prontuario','read')){
        try{
          const tl=await api.get('/prontuario/paciente/'+id+'/timeline');
          setTimeline(Array.isArray(tl.data?.data)?tl.data.data:[]);
        }catch{}
      }
    }catch(e){setError(errMsg(e))}
  };
  useEffect(()=>{load()},[id]);

  const ativa=useMemo(()=>data?.internacoes?.find(i=>i.status==='ATIVA'),[data]);
  const problemasAtivos=useMemo(()=>data?.problemasClinicos?.filter(p=>p.status==='ATIVO')||[],[data]);
  const ultimasMedicoes=useMemo(()=>{
    const result={};
    for(const m of data?.medicoesClinicas||[])if(!result[m.codigo])result[m.codigo]=m;
    return Object.values(result);
  },[data]);

  const filteredTimeline=useMemo(()=>{
    if(filter==='TODOS')return timeline;
    if(filter==='PROBLEMAS')return timeline.filter(x=>x.tipoEvento==='PROBLEMA');
    return timeline.filter(x=>{
      if(x.tipoEvento!=='EVOLUCAO')return false;
      const cat=x.item?.template?.categoriaProfissional;
      if(cat)return cat===filter;
      if(filter==='MEDICA')return x.item?.tipo==='MEDICA';
      if(filter==='ENFERMAGEM')return x.item?.tipo==='ENFERMAGEM';
      return filter==='MULTIPROFISSIONAL'&&x.item?.tipo==='MULTIPROFISSIONAL';
    });
  },[timeline,filter]);

  if(!data)return <><PageTitle title="Paciente"/><ErrorBox error={error}/><div className="card p-8 text-slate-500">Carregando cadastro...</div></>;

  const filterOptions=[['TODOS','Todos'],['MEDICA','Médica'],['ENFERMAGEM','Enfermagem'],['FISIOTERAPIA','Fisioterapia'],['MULTIPROFISSIONAL','Multiprofissional'],['PROBLEMAS','Problemas']];

  return <><div className="mb-4"><Link to="/pacientes" className="text-sm font-semibold text-blue-700">← Voltar para pacientes</Link></div>
    <PageTitle title={data.nome} subtitle={'Prontuário '+data.prontuario}/>
    <ErrorBox error={error}/>

    <div className="grid md:grid-cols-5 gap-3 mb-4">
      <div className="card p-4"><div className="text-xs text-slate-500">Situação</div><div className="font-bold mt-1">{ativa?<><Status value="ATIVA"/> <span className="ml-2">Leito {ativa.leito?.numero}</span></>:'Sem internação ativa'}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Nascimento</div><div className="font-bold mt-1">{fmtDate(data.dataNascimento)}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Internações</div><div className="text-2xl font-bold">{data.internacoes?.length||0}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Evoluções</div><div className="text-2xl font-bold">{data.evolucoes?.length||0}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Problemas ativos</div><div className="text-2xl font-bold">{problemasAtivos.length}</div></div>
    </div>

    <div className="card p-2 mb-4 flex gap-2 flex-wrap">
      {[['resumo','Resumo'],['internacoes','Histórico de internações'],['prontuario','Linha do tempo clínica']].map(([k,l])=><button key={k} className={'btn '+(tab===k?'btn-primary':'btn-secondary')} onClick={()=>setTab(k)}>{l}</button>)}
    </div>

    {tab==='resumo'&&<div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5"><h2 className="font-bold mb-4">Dados cadastrais</h2><div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><div className="text-slate-500">Prontuário</div><b>{data.prontuario}</b></div><div><div className="text-slate-500">CPF</div><b>{data.cpf||'—'}</b></div>
          <div><div className="text-slate-500">Sexo</div><b>{data.sexo||'—'}</b></div><div><div className="text-slate-500">Telefone</div><b>{data.telefoneContato||'—'}</b></div>
          <div><div className="text-slate-500">Acompanhante</div><b>{data.nomeAcompanhante||'—'}</b></div><div><div className="text-slate-500">Precauções</div><b>{data.precaucoes?.join(', ')||'Nenhuma'}</b></div>
        </div></div>
        <div className="card p-5"><h2 className="font-bold mb-4">Contexto clínico atual</h2><div className="text-sm space-y-3"><div><div className="text-slate-500">Diagnóstico cadastral</div><b>{data.diagnostico||'—'}</b></div>{ativa?<><div><div className="text-slate-500">Leito atual</div><b>{ativa.leito?.numero} · {ativa.leito?.tipo}</b></div><div><div className="text-slate-500">Entrada</div><b>{fmtBrasilia(ativa.dataInternacao)}</b></div><div><div className="text-slate-500">Previsão de alta</div><b>{fmtDate(ativa.previsaoAlta)}</b></div></>:<div className="text-slate-500">Paciente sem internação ativa.</div>}</div></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5"><h2 className="font-bold mb-3">Problemas e diagnósticos ativos</h2>{problemasAtivos.length?<div className="space-y-2">{problemasAtivos.map(p=><div key={p.id} className="border rounded-lg p-3"><b>{p.descricao}</b><div className="text-xs text-slate-500 mt-1">Desde {fmtBrasilia(p.iniciadoEm)}{p.eventos?.[0]?' · último evento '+p.eventos[0].tipo+' em '+fmtBrasilia(p.eventos[0].ocorridoEm):''}</div></div>)}</div>:<div className="text-sm text-slate-500">Nenhum problema ativo.</div>}</div>
        <div className="card p-5"><h2 className="font-bold mb-3">Últimas medições</h2>{ultimasMedicoes.length?<div className="flex flex-wrap gap-2">{ultimasMedicoes.map(m=><div key={m.id} className="bg-slate-50 rounded-lg px-3 py-2"><div className="text-xs text-slate-500">{measurementLabels[m.codigo]||m.codigo}</div><b>{measurementValue(m)}</b><div className="text-[11px] text-slate-400">{fmtBrasilia(m.observadoEm)}</div></div>)}</div>:<div className="text-sm text-slate-500">Nenhuma medição estruturada registrada.</div>}</div>
      </div>
    </div>}

    {tab==='internacoes'&&<div className="card overflow-x-auto"><table className="table"><thead><tr><th>Status</th><th>Entrada</th><th>Alta</th><th>Leito</th><th>Observações</th></tr></thead><tbody>{data.internacoes?.map(i=><tr key={i.id}><td><Status value={i.status}/></td><td>{fmtBrasilia(i.dataInternacao)}</td><td>{fmtBrasilia(i.dataAlta)}</td><td>{i.leito?.numero||'—'} · {i.leito?.tipo||'—'}</td><td className="max-w-lg whitespace-pre-wrap">{i.observacoesInternacao||i.observacoesAlta||'—'}</td></tr>)}{!data.internacoes?.length&&<tr><td colSpan="5" className="text-center text-slate-500 py-8">Nenhuma internação registrada.</td></tr>}</tbody></table></div>}

    {tab==='prontuario'&&<>
      <div className="mb-3 flex gap-2 flex-wrap">{filterOptions.map(([key,label])=><button key={key} className={'btn '+(filter===key?'btn-primary':'btn-secondary')} onClick={()=>setFilter(key)}>{label}</button>)}</div>
      {timeline.length?<ClinicalTimeline timeline={filteredTimeline}/>:<div className="space-y-3">{data.evolucoes?.map(x=><div className="card p-4" key={x.id}><div className="flex justify-between gap-3 text-sm"><b>{x.template?.nome||x.tipo}</b><span>{fmtBrasilia(x.createdAt)}</span></div><div className="text-xs text-slate-500 mb-3">{x.profissional?.nome||x.criadoPorNome} · {x.profissional?.cargo||x.criadoPorCargo}</div><p>{x.observacoes}</p></div>)}</div>}
    </>}
  </>;
}
