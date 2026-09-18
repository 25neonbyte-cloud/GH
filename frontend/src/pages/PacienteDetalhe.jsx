import { useEffect,useMemo,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { api,errMsg } from '../services/api';
import { ErrorBox,PageTitle,Status } from '../components/Common';

const fmt=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
const fmtDate=v=>v?new Date(v).toLocaleDateString('pt-BR'):'—';

export default function PacienteDetalhe(){
  const {id}=useParams();
  const [data,setData]=useState(null),[tab,setTab]=useState('resumo'),[error,setError]=useState('');
  const load=async()=>{try{const r=await api.get(`/pacientes/${id}`);setData(r.data);setError('')}catch(e){setError(errMsg(e))}};
  useEffect(()=>{load()},[id]);

  const ativa=useMemo(()=>data?.internacoes?.find(i=>i.status==='ATIVA'),[data]);
  if(!data)return <><PageTitle title="Paciente"/><ErrorBox error={error}/><div className="card p-8 text-slate-500">Carregando cadastro...</div></>;

  return <><div className="mb-4"><Link to="/pacientes" className="text-sm font-semibold text-blue-700">← Voltar para pacientes</Link></div>
    <PageTitle title={data.nome} subtitle={`Prontuário ${data.prontuario}`}/>
    <ErrorBox error={error}/>

    <div className="grid md:grid-cols-4 gap-3 mb-4">
      <div className="card p-4"><div className="text-xs text-slate-500">Situação</div><div className="font-bold mt-1">{ativa?<><Status value="ATIVA"/> <span className="ml-2">Leito {ativa.leito?.numero}</span></>:'Sem internação ativa'}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Nascimento</div><div className="font-bold mt-1">{fmtDate(data.dataNascimento)}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Internações</div><div className="text-2xl font-bold">{data.internacoes?.length||0}</div></div>
      <div className="card p-4"><div className="text-xs text-slate-500">Evoluções</div><div className="text-2xl font-bold">{data.evolucoes?.length||0}</div></div>
    </div>

    <div className="card p-2 mb-4 flex gap-2 flex-wrap">
      {[['resumo','Resumo'],['internacoes','Histórico de internações'],['prontuario','Prontuário / evoluções']].map(([k,l])=><button key={k} className={`btn ${tab===k?'btn-primary':'btn-secondary'}`} onClick={()=>setTab(k)}>{l}</button>)}
    </div>

    {tab==='resumo'&&<div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5"><h2 className="font-bold mb-4">Dados cadastrais</h2><div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div><div className="text-slate-500">Prontuário</div><b>{data.prontuario}</b></div><div><div className="text-slate-500">CPF</div><b>{data.cpf||'—'}</b></div>
        <div><div className="text-slate-500">Sexo</div><b>{data.sexo||'—'}</b></div><div><div className="text-slate-500">Telefone</div><b>{data.telefoneContato||'—'}</b></div>
        <div><div className="text-slate-500">Acompanhante</div><b>{data.nomeAcompanhante||'—'}</b></div><div><div className="text-slate-500">Precauções</div><b>{data.precaucoes?.join(', ')||'Nenhuma'}</b></div>
      </div></div>
      <div className="card p-5"><h2 className="font-bold mb-4">Contexto clínico atual</h2><div className="text-sm space-y-3"><div><div className="text-slate-500">Diagnóstico</div><b>{data.diagnostico||'—'}</b></div>{ativa?<><div><div className="text-slate-500">Leito atual</div><b>{ativa.leito?.numero} · {ativa.leito?.tipo}</b></div><div><div className="text-slate-500">Entrada</div><b>{fmt(ativa.dataInternacao)}</b></div><div><div className="text-slate-500">Previsão de alta</div><b>{fmtDate(ativa.previsaoAlta)}</b></div></>:<div className="text-slate-500">Paciente sem internação ativa.</div>}</div></div>
    </div>}

    {tab==='internacoes'&&<div className="card overflow-x-auto"><table className="table"><thead><tr><th>Status</th><th>Entrada</th><th>Alta</th><th>Leito</th><th>Observações</th></tr></thead><tbody>{data.internacoes?.map(i=><tr key={i.id}><td><Status value={i.status}/></td><td>{fmt(i.dataInternacao)}</td><td>{fmt(i.dataAlta)}</td><td>{i.leito?.numero||'—'} · {i.leito?.tipo||'—'}</td><td className="max-w-lg whitespace-pre-wrap">{i.observacoesInternacao||i.observacoesAlta||'—'}</td></tr>)}{!data.internacoes?.length&&<tr><td colSpan="5" className="text-center text-slate-500 py-8">Nenhuma internação registrada.</td></tr>}</tbody></table></div>}

    {tab==='prontuario'&&<div className="space-y-3">{data.evolucoes?.map(x=><div className="card p-4" key={x.id}><div className="flex justify-between gap-3 text-sm"><b>{x.tipo}</b><span>{fmt(x.createdAt)}</span></div><div className="text-xs text-slate-500 mb-3">{x.criadoPorNome} · {x.criadoPorCargo}</div>{x.sinaisVitais&&<div className="text-sm mb-2">PA {x.sinaisVitais.pa||'—'} · FC {x.sinaisVitais.fc||'—'} · Temp {x.sinaisVitais.temp||'—'} · SpO₂ {x.sinaisVitais.spo2||'—'}</div>}{x.queixas&&<div className="text-sm"><b>Queixa:</b> {x.queixas}</div>}{x.condutaMedica&&<div className="text-sm"><b>Conduta:</b> {x.condutaMedica}</div>}<p className="mt-2">{x.observacoes}</p></div>)}{!data.evolucoes?.length&&<div className="card p-8 text-center text-slate-500">Nenhuma evolução registrada.</div>}</div>}
  </>;
}
