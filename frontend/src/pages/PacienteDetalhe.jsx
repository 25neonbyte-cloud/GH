import { useEffect,useMemo,useState } from 'react';
import { Link,useParams,useSearchParams } from 'react-router-dom';
import { api,errMsg } from '../services/api';
import { ErrorBox,Modal,PageTitle,Status } from '../components/Common';
import ClinicalTimeline from '../components/clinical/ClinicalTimeline';
import PatientEvolutionPanel from '../components/clinical/PatientEvolutionPanel';
import TriagePanel from '../components/clinical/TriagePanel';
import { fmtBrasilia,measurementLabels,measurementValue } from '../utils/clinical';
import { useAuth } from '../context/AuthContext';

const fmtDate=v=>v?new Date(v).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';

export default function PacienteDetalhe(){
  const {id}=useParams();
  const {can}=useAuth();
  const [searchParams,setSearchParams]=useSearchParams();
  const initialTab=searchParams.get('tab')||'resumo';
  const [data,setData]=useState(null),[timeline,setTimeline]=useState([]),[tab,setTab]=useState(initialTab),[filter,setFilter]=useState('TODOS');
  const [error,setError]=useState(''),[success,setSuccess]=useState('');
  const [beds,setBeds]=useState([]),[transfer,setTransfer]=useState(null),[alta,setAlta]=useState(null),[admission,setAdmission]=useState(null);

  const load=async()=>{
    try{
      const patient=await api.get('/pacientes/'+id);
      setData(patient.data);
      if(can('prontuario','read')){
        try{const tl=await api.get('/prontuario/paciente/'+id+'/timeline');setTimeline(Array.isArray(tl.data?.data)?tl.data.data:[])}catch{}
      }
      setError('');
    }catch(e){setError(errMsg(e))}
  };
  useEffect(()=>{load()},[id]);

  const setActiveTab=value=>{setTab(value);setSearchParams(value==='resumo'?{}:{tab:value},{replace:true})};

  const ativa=useMemo(()=>data?.internacoes?.find(i=>i.status==='ATIVA'),[data]);
  const problemasAtivos=useMemo(()=>data?.problemasClinicos?.filter(p=>p.status==='ATIVO')||[],[data]);
  const ultimasMedicoes=useMemo(()=>{const result={};for(const m of data?.medicoesClinicas||[])if(!result[m.codigo])result[m.codigo]=m;return Object.values(result)},[data]);

  const filteredTimeline=useMemo(()=>{
    if(filter==='TODOS')return timeline;
    if(filter==='PROBLEMAS')return timeline.filter(x=>x.tipoEvento==='PROBLEMA');
    return timeline.filter(x=>{
      if(x.tipoEvento!=='EVOLUCAO')return false;
      const cat=x.item?.template?.categoriaProfissional;
      if(filter==='TRIAGEM')return cat==='TRIAGEM'||x.item?.tipo==='TRIAGEM';
      if(cat)return cat===filter;
      if(filter==='MEDICA')return x.item?.tipo==='MEDICA';
      if(filter==='ENFERMAGEM')return x.item?.tipo==='ENFERMAGEM';
      return filter==='MULTIPROFISSIONAL'&&x.item?.tipo==='MULTIPROFISSIONAL';
    });
  },[timeline,filter]);

  const loadBeds=async()=>{const r=await api.get('/leitos/disponiveis');const items=Array.isArray(r.data?.data)?r.data.data:[];setBeds(items);return items};

  const openTransfer=async()=>{try{await loadBeds();setTransfer({novoLeitoId:'',motivo:''})}catch(e){setError(errMsg(e))}};
  const doTransfer=async e=>{e.preventDefault();try{await api.post('/internacoes/'+ativa.id+'/transferir',transfer);setTransfer(null);setSuccess('Transferência registrada.');await load()}catch(e){setError(errMsg(e))}};
  const doDischarge=async e=>{e.preventDefault();try{await api.put('/internacoes/'+ativa.id+'/finalizar',{dataAlta:alta.dataAlta||undefined,observacoesAlta:alta.observacoesAlta});setAlta(null);setSuccess('Alta registrada e leito liberado.');await load()}catch(e){setError(errMsg(e))}};
  const openAdmission=async()=>{try{await loadBeds();setAdmission({leitoId:'',dataInternacao:'',previsaoAlta:'',observacoesInternacao:''})}catch(e){setError(errMsg(e))}};
  const doAdmission=async e=>{e.preventDefault();try{await api.post('/internacoes',{pacienteId:id,...admission,dataInternacao:admission.dataInternacao||undefined,previsaoAlta:admission.previsaoAlta||undefined});setAdmission(null);setSuccess('Internação registrada.');await load()}catch(e){setError(errMsg(e))}};

  if(!data)return <><PageTitle title="Paciente"/><ErrorBox error={error}/><div className="card p-8 text-slate-500">Carregando cadastro...</div></>;

  const tabs=[
    ['resumo','Resumo'],
    ['atendimento','Atendimento atual'],
    ...(can('prontuario','read')?[['triagem','Triagem'],['evolucao','Evolução'],['timeline','Linha do tempo']]:[]),
    ['internacoes','Histórico de internações'],
  ];
  const filterOptions=[['TODOS','Todos'],['TRIAGEM','Triagem'],['MEDICA','Médica'],['ENFERMAGEM','Enfermagem'],['FISIOTERAPIA','Fisioterapia'],['MULTIPROFISSIONAL','Multiprofissional'],['PROBLEMAS','Problemas']];

  return <><div className="mb-4"><Link to="/pacientes" className="text-sm font-semibold text-blue-700">← Voltar para pacientes</Link></div>
    <PageTitle title={data.nome} subtitle={'Prontuário '+data.prontuario}/>
    <ErrorBox error={error}/>{success&&<div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}

    <div className="grid md:grid-cols-5 gap-3 mb-4">
      <div className="card p-4"><div className="text-xs text-slate-500">Situação</div><div className="font-bold mt-1">{ativa?<><Status value="ATIVA"/> <span className="ml-2">Leito {ativa.leito?.numero}</span></>:'Sem internação ativa'}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Nascimento</div><div className="font-bold mt-1">{fmtDate(data.dataNascimento)}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Internações</div><div className="text-2xl font-bold">{data.internacoes?.length||0}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Evoluções</div><div className="text-2xl font-bold">{data.evolucoes?.length||0}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Problemas ativos</div><div className="text-2xl font-bold">{problemasAtivos.length}</div></div>
    </div>

    <div className="card p-2 mb-4 flex gap-2 flex-wrap">{tabs.map(([k,l])=><button key={k} className={'btn '+(tab===k?'btn-primary':'btn-secondary')} onClick={()=>setActiveTab(k)}>{l}</button>)}</div>

    {tab==='resumo'&&<div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5"><h2 className="font-bold mb-4">Dados cadastrais</h2><div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><div className="text-slate-500">Prontuário</div><b>{data.prontuario}</b></div><div><div className="text-slate-500">CPF</div><b>{data.cpf||'—'}</b></div>
          <div><div className="text-slate-500">Sexo</div><b>{data.sexo||'—'}</b></div><div><div className="text-slate-500">Telefone</div><b>{data.telefoneContato||'—'}</b></div>
          <div><div className="text-slate-500">Acompanhante</div><b>{data.nomeAcompanhante||'—'}</b></div><div><div className="text-slate-500">Precauções atuais</div><b>{data.precaucoes?.join(', ')||'Nenhuma'}</b></div>
        </div></div>
        <div className="card p-5"><h2 className="font-bold mb-4">Contexto assistencial</h2><div className="text-sm space-y-3"><div><div className="text-slate-500">Diagnóstico cadastral legado</div><b>{data.diagnostico||'—'}</b></div>{ativa?<><div><div className="text-slate-500">Leito atual</div><b>{ativa.leito?.numero} · {ativa.leito?.tipo}</b></div><div><div className="text-slate-500">Entrada</div><b>{fmtBrasilia(ativa.dataInternacao)}</b></div><div><div className="text-slate-500">Previsão de alta</div><b>{fmtDate(ativa.previsaoAlta)}</b></div></>:<div className="text-slate-500">Paciente sem internação ativa.</div>}</div></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5"><h2 className="font-bold mb-3">Problemas e diagnósticos ativos</h2>{problemasAtivos.length?<div className="space-y-2">{problemasAtivos.map(p=><div key={p.id} className="border rounded-lg p-3"><b>{p.descricao}</b><div className="text-xs text-slate-500 mt-1">Desde {fmtBrasilia(p.iniciadoEm)}</div></div>)}</div>:<div className="text-sm text-slate-500">Nenhum problema ativo.</div>}</div>
        <div className="card p-5"><h2 className="font-bold mb-3">Últimas medições</h2>{ultimasMedicoes.length?<div className="flex flex-wrap gap-2">{ultimasMedicoes.map(m=><div key={m.id} className="bg-slate-50 rounded-lg px-3 py-2"><div className="text-xs text-slate-500">{measurementLabels[m.codigo]||m.codigo}</div><b>{measurementValue(m)}</b><div className="text-[11px] text-slate-400">{fmtBrasilia(m.observadoEm)}</div></div>)}</div>:<div className="text-sm text-slate-500">Nenhuma medição estruturada registrada.</div>}</div>
      </div>
    </div>}

    {tab==='atendimento'&&<div className="card p-5">
      <div className="flex flex-col md:flex-row md:justify-between gap-3"><div><h2 className="font-bold text-lg">Gerenciar atendimento</h2><p className="text-sm text-slate-500">Leito, transferência e alta pertencem à internação, não ao cadastro do paciente.</p></div>{can('internacoes','write')&&(ativa?<div className="flex gap-2"><button className="btn btn-secondary" onClick={openTransfer}>Transferir</button><button className="btn btn-primary" onClick={()=>setAlta({dataAlta:'',observacoesAlta:''})}>Dar alta</button></div>:<button className="btn btn-primary" onClick={openAdmission}>Registrar internação</button>)}</div>
      {ativa?<div className="grid md:grid-cols-4 gap-3 mt-5 text-sm"><div><div className="text-slate-500">Leito</div><b>{ativa.leito?.numero} · {ativa.leito?.tipo}</b></div><div><div className="text-slate-500">Entrada</div><b>{fmtBrasilia(ativa.dataInternacao)}</b></div><div><div className="text-slate-500">Previsão de alta</div><b>{fmtDate(ativa.previsaoAlta)}</b></div><div><div className="text-slate-500">Observações</div><b>{ativa.observacoesInternacao||'—'}</b></div></div>:<div className="mt-5 text-slate-500">Não há internação ativa para este paciente.</div>}
    </div>}

    {tab==='triagem'&&can('prontuario','read')&&<TriagePanel patientId={id} patient={data} onChanged={load}/>}
    {tab==='evolucao'&&can('prontuario','read')&&<PatientEvolutionPanel patientId={id} onChanged={load}/>}

    {tab==='timeline'&&can('prontuario','read')&&<><div className="mb-3 flex gap-2 flex-wrap">{filterOptions.map(([key,label])=><button key={key} className={'btn '+(filter===key?'btn-primary':'btn-secondary')} onClick={()=>setFilter(key)}>{label}</button>)}</div><ClinicalTimeline timeline={filteredTimeline}/></>}

    {tab==='internacoes'&&<div className="card overflow-x-auto"><table className="table"><thead><tr><th>Status</th><th>Entrada</th><th>Alta</th><th>Leito</th><th>Observações</th></tr></thead><tbody>{data.internacoes?.map(i=><tr key={i.id}><td><Status value={i.status}/></td><td>{fmtBrasilia(i.dataInternacao)}</td><td>{fmtBrasilia(i.dataAlta)}</td><td>{i.leito?.numero||'—'} · {i.leito?.tipo||'—'}</td><td className="max-w-lg whitespace-pre-wrap">{i.observacoesInternacao||i.observacoesAlta||'—'}</td></tr>)}{!data.internacoes?.length&&<tr><td colSpan="5" className="text-center text-slate-500 py-8">Nenhuma internação registrada.</td></tr>}</tbody></table></div>}

    <Modal open={!!transfer} title="Transferir paciente" onClose={()=>setTransfer(null)}>{transfer&&<form onSubmit={doTransfer} className="grid gap-3"><div className="bg-slate-50 rounded p-3 text-sm"><b>{data.nome}</b><br/>Leito atual: {ativa?.leito?.numero}</div><label><span className="label">Novo leito livre</span><select className="input" required value={transfer.novoLeitoId} onChange={e=>setTransfer({...transfer,novoLeitoId:e.target.value})}><option value="">Selecione</option>{beds.map(b=><option key={b.id} value={b.id}>{b.numero} — {b.andar}º andar — {b.tipo}</option>)}</select></label><label><span className="label">Motivo / observação</span><textarea className="input" value={transfer.motivo} onChange={e=>setTransfer({...transfer,motivo:e.target.value})}/></label><button className="btn btn-primary">Confirmar transferência</button></form>}</Modal>
    <Modal open={!!alta} title="Confirmar alta" onClose={()=>setAlta(null)}>{alta&&<form onSubmit={doDischarge} className="grid gap-3"><label><span className="label">Data/hora da alta</span><input type="datetime-local" className="input" value={alta.dataAlta} onChange={e=>setAlta({...alta,dataAlta:e.target.value})}/><small className="text-slate-400">Em branco = agora</small></label><label><span className="label">Observações de alta</span><textarea className="input" value={alta.observacoesAlta} onChange={e=>setAlta({...alta,observacoesAlta:e.target.value})}/></label><button className="btn btn-primary">Confirmar alta</button></form>}</Modal>
    <Modal open={!!admission} title="Registrar internação" onClose={()=>setAdmission(null)}>{admission&&<form onSubmit={doAdmission} className="grid gap-3"><label><span className="label">Leito livre</span><select className="input" required value={admission.leitoId} onChange={e=>setAdmission({...admission,leitoId:e.target.value})}><option value="">Selecione</option>{beds.map(b=><option key={b.id} value={b.id}>{b.numero} — {b.andar}º andar — {b.tipo}</option>)}</select></label><label><span className="label">Data/hora</span><input type="datetime-local" className="input" value={admission.dataInternacao} onChange={e=>setAdmission({...admission,dataInternacao:e.target.value})}/></label><label><span className="label">Previsão de alta</span><input type="date" className="input" value={admission.previsaoAlta} onChange={e=>setAdmission({...admission,previsaoAlta:e.target.value})}/></label><label><span className="label">Observações</span><textarea className="input" value={admission.observacoesInternacao} onChange={e=>setAdmission({...admission,observacoesInternacao:e.target.value})}/></label><button className="btn btn-primary">Confirmar internação</button></form>}</Modal>
  </>;
}
