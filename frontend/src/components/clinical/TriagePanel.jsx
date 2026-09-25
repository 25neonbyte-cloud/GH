import { useEffect,useState } from 'react';
import { api,errMsg } from '../../services/api';
import { ErrorBox } from '../Common';
import { useAuth } from '../../context/AuthContext';
import ClinicalForm from './ClinicalForm';
import { emptyClinicalForm,measurementLabels,measurementPlaceholders,measurementUnits } from '../../utils/clinical';

const emptyMeasurements={pa:'',fc:'',fr:'',temp:'',spo2:'',glicemia:''};
const precautionOptions=['ISOLAMENTO','COVID','ALERGIA_LATEX'];

export default function TriagePanel({patientId,patient,onChanged}){
  const {can}=useAuth();
  const [template,setTemplate]=useState(null),[content,setContent]=useState({}),[measurements,setMeasurements]=useState(emptyMeasurements);
  const [precautions,setPrecautions]=useState(patient?.precaucoes||[]),[error,setError]=useState(''),[success,setSuccess]=useState('');

  useEffect(()=>{setPrecautions(patient?.precaucoes||[])},[patient?.precaucoes]);
  useEffect(()=>{
    api.get('/prontuario/triagem/template').then(r=>{setTemplate(r.data);setContent(emptyClinicalForm(r.data))}).catch(e=>setError(errMsg(e)));
  },[]);

  const toggle=p=>setPrecautions(v=>v.includes(p)?v.filter(x=>x!==p):[...v,p]);

  const save=async e=>{e.preventDefault();try{
    await api.post('/prontuario/paciente/'+patientId+'/triagem',{conteudo:content,medicoesClinicas:measurements,precaucoes:precautions});
    setContent(emptyClinicalForm(template));setMeasurements(emptyMeasurements);setSuccess('Triagem registrada na linha do tempo do paciente.');onChanged?.();
  }catch(e){setError(errMsg(e))}};

  if(!template)return <div className="card p-6 text-slate-500">Carregando ficha de triagem...</div>;

  if(!can('prontuario','write'))return <div className="card p-6 text-slate-500">Seu perfil possui acesso de leitura ao prontuário, sem permissão para registrar triagem.</div>;

  return <form onSubmit={save} className="card p-4">
    <ErrorBox error={error}/>{success&&<div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}
    <div className="mb-4"><h2 className="font-bold text-lg">Nova triagem</h2><p className="text-sm text-slate-500">Cada registro fica associado ao paciente, internação atual, profissional e horário, entrando automaticamente na linha do tempo.</p></div>
    <div className="border rounded-xl p-4 mb-4"><h3 className="font-bold mb-3">Sinais vitais / medições</h3><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Object.keys(emptyMeasurements).map(key=><label key={key}><span className="label">{measurementLabels[key]} <span className="text-slate-400 font-normal">({measurementUnits[key]})</span></span><input className="input" placeholder={measurementPlaceholders[key]} value={measurements[key]} onChange={e=>setMeasurements({...measurements,[key]:e.target.value})}/></label>)}</div></div>
    <div className="border rounded-xl p-4 mb-4"><h3 className="font-bold mb-3">Precauções atuais</h3><div className="flex flex-wrap gap-4 text-sm">{precautionOptions.map(p=><label key={p} className="flex items-center gap-2"><input type="checkbox" checked={precautions.includes(p)} onChange={()=>toggle(p)}/>{p.replaceAll('_',' ')}</label>)}</div><p className="text-xs text-slate-500 mt-2">A confirmação desta triagem atualiza as precauções operacionais do paciente e preserva o registro histórico na evolução.</p></div>
    <ClinicalForm template={template} values={content} inherited={[]} onChange={(key,value)=>setContent(v=>({...v,[key]:value}))}/>
    <button className="btn btn-primary w-full mt-4">Registrar triagem</button>
  </form>;
}
