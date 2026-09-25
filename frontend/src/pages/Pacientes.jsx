import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { api,errMsg } from '../services/api';
import { ErrorBox,Modal,PageTitle } from '../components/Common';
import { useAuth } from '../context/AuthContext';

const empty={prontuario:'',nome:'',cpf:'',dataNascimento:'',sexo:'',nomeAcompanhante:'',telefoneContato:''};
const toDateInput=value=>value?String(value).slice(0,10):'';

export default function Pacientes(){
  const {can}=useAuth();
  const [list,setList]=useState([]),[q,setQ]=useState(''),[open,setOpen]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState(empty),[error,setError]=useState(''),[success,setSuccess]=useState('');

  const load=async()=>{try{const r=await api.get('/pacientes',{params:{search:q}});setList(Array.isArray(r.data?.data)?r.data.data:[]);setError('')}catch(e){setError(errMsg(e))}};
  useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t)},[q]);

  const novo=()=>{setEditing(null);setForm(empty);setOpen(true)};
  const editar=p=>{setEditing(p);setForm({prontuario:p.prontuario||'',nome:p.nome||'',cpf:p.cpf||'',dataNascimento:toDateInput(p.dataNascimento),sexo:p.sexo||'',nomeAcompanhante:p.nomeAcompanhante||'',telefoneContato:p.telefoneContato||''});setOpen(true)};

  const save=async e=>{e.preventDefault();try{
    if(editing)await api.put('/pacientes/'+editing.id,form);else await api.post('/pacientes',form);
    setOpen(false);setForm(empty);setSuccess(editing?'Cadastro do paciente atualizado.':'Paciente cadastrado.');setEditing(null);await load();
  }catch(e){setError(errMsg(e))}};

  const remove=async p=>{if(!window.confirm('Excluir o cadastro de '+p.nome+'? Pacientes com internação ativa não podem ser excluídos.'))return;try{await api.delete('/pacientes/'+p.id);setSuccess('Cadastro removido.');await load()}catch(e){setError(errMsg(e))}};

  return <><PageTitle title="Pacientes" subtitle="Cadastro, atendimento, triagem, evolução e histórico em um único fluxo" action={can('pacientes','write')?<button className="btn btn-primary" onClick={novo}>Novo paciente</button>:null}/>
    <ErrorBox error={error}/>{success&&<div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">{success}</div>}
    <div className="card p-4 mb-4 flex gap-3 items-center"><input className="input max-w-lg" placeholder="Buscar por nome, prontuário ou CPF" value={q} onChange={e=>setQ(e.target.value)}/><span className="text-sm text-slate-500">{list.length} resultado(s)</span></div>
    <div className="card overflow-x-auto"><table className="table"><thead><tr><th>Prontuário</th><th>Nome</th><th>Nascimento</th><th>Internação atual</th><th>Precauções</th><th>Ações</th></tr></thead><tbody>
      {list.map(p=><tr key={p.id}>
        <td>{p.prontuario}</td>
        <td className="font-semibold"><Link className="text-blue-700 hover:underline" to={'/pacientes/'+p.id}>{p.nome}</Link></td>
        <td>{p.dataNascimento?new Date(p.dataNascimento).toLocaleDateString('pt-BR',{timeZone:'UTC'}):'—'}</td>
        <td>{p.internacoes?.[0]?<span className="font-semibold text-blue-700">Leito {p.internacoes[0].leito?.numero}</span>:'—'}</td>
        <td>{p.precaucoes?.length?p.precaucoes.join(', '):'—'}</td>
        <td><div className="flex gap-3 flex-wrap">
          <Link className="text-blue-700 font-semibold text-sm" to={'/pacientes/'+p.id}>Abrir prontuário</Link>
          {can('internacoes','write')&&<Link className="text-indigo-700 font-semibold text-sm" to={'/pacientes/'+p.id+'?tab=atendimento'}>Gerenciar atendimento</Link>}
          {can('pacientes','write')&&<button className="text-slate-700 font-semibold text-sm" onClick={()=>editar(p)}>Editar cadastro</button>}
          {can('pacientes','delete')&&<button className="text-red-700 font-semibold text-sm" onClick={()=>remove(p)}>Excluir</button>}
        </div></td>
      </tr>)}
      {!list.length&&<tr><td colSpan="6" className="text-center text-slate-500 py-8">Nenhum paciente encontrado.</td></tr>}
    </tbody></table></div>

    <Modal open={open} title={editing?'Editar cadastro do paciente':'Novo paciente'} onClose={()=>setOpen(false)}>
      <form onSubmit={save} className="grid md:grid-cols-2 gap-3">
        {[['prontuario','Prontuário'],['nome','Nome'],['cpf','CPF'],['dataNascimento','Data de nascimento'],['nomeAcompanhante','Acompanhante'],['telefoneContato','Telefone']].map(([k,l])=><label key={k}><span className="label">{l}</span><input className="input" type={k==='dataNascimento'?'date':'text'} required={['prontuario','nome','dataNascimento'].includes(k)} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}
        <label><span className="label">Sexo</span><select className="input" value={form.sexo} onChange={e=>setForm({...form,sexo:e.target.value})}><option value="">Não informado</option><option value="M">Masculino</option><option value="F">Feminino</option><option value="OUTRO">Outro</option></select></label>
        <div className="md:col-span-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">Diagnósticos, precauções e dados de triagem são registrados no prontuário e preservados na linha do tempo clínica.</div>
        <button className="btn btn-primary md:col-span-2">{editing?'Salvar cadastro':'Salvar paciente'}</button>
      </form>
    </Modal>
  </>;
}
