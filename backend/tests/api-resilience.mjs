const base='http://localhost:3001';

async function json(path, options={}) {
  const res=await fetch(base+path, options);
  let body=null;
  try { body=await res.json(); } catch {}
  return {res,body};
}

function expectStatus(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: esperado HTTP ${expected}, recebido ${actual}`);
}

async function assertHealth(label) {
  const {res,body}=await json('/health');
  expectStatus(res.status,200,label);
  if(body?.status!=='OK') throw new Error(`${label}: health sem status OK`);
}

await assertHealth('health inicial');

const login=await json('/api/auth/login',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({username:'admin',password:'Admin123!'}),
});
expectStatus(login.res.status,200,'login admin');
const token=login.body?.token;
if(!token) throw new Error('login admin não retornou token');
const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};

const invalidPatient=await json('/api/pacientes',{
  method:'POST',headers,
  body:JSON.stringify({prontuario:'1',nome:'Paciente Teste',dataNascimento:'1990-01-01'}),
});
expectStatus(invalidPatient.res.status,400,'validação de paciente inválido');
await assertHealth('health após erro 400');

const pros=await json('/api/profissionais',{headers});
expectStatus(pros.res.status,200,'listar profissionais');
const firstPro=pros.body?.data?.[0];
if(!firstPro) throw new Error('base demonstrativa sem profissional');
const duplicatePro=await json('/api/profissionais',{
  method:'POST',headers,
  body:JSON.stringify({nome:'Duplicado Teste',registroConselho:firstPro.registroConselho,cargo:'ENFERMEIRO'}),
});
expectStatus(duplicatePro.res.status,409,'registro profissional duplicado');
await assertHealth('health após erro Prisma 409');

const patientList=await json('/api/pacientes',{headers});
expectStatus(patientList.res.status,200,'listar pacientes para teste clínico');
const clinicalPatient=patientList.body?.data?.[0];
if(!clinicalPatient) throw new Error('base demonstrativa sem paciente para teste clínico');

const templateList=await json('/api/prontuario/templates/minha',{headers});
expectStatus(templateList.res.status,200,'listar templates clínicos');
const clinicalTemplate=templateList.body?.data?.find(x=>x.categoriaProfissional==='MULTIPROFISSIONAL')||templateList.body?.data?.[0];
if(!clinicalTemplate) throw new Error('base demonstrativa sem template clínico');

const invalidClinical=await json('/api/prontuario/paciente/'+clinicalPatient.id,{
  method:'POST',headers,
  body:JSON.stringify({
    templateId:clinicalTemplate.id,
    conteudo:{observacao:'Teste automatizado de validação'},
    medicoesClinicas:{fc:'123456789as',temp:'abc123'},
  }),
});
expectStatus(invalidClinical.res.status,400,'sinais vitais inválidos');
await assertHealth('health após validação clínica 400');

const validClinical=await json('/api/prontuario/paciente/'+clinicalPatient.id,{
  method:'POST',headers,
  body:JSON.stringify({
    templateId:clinicalTemplate.id,
    conteudo:{observacao:'Evolução estruturada criada pelo teste de resiliência'},
    medicoesClinicas:{pa:'120/80',fc:80,temp:36.7,spo2:98},
  }),
});
expectStatus(validClinical.res.status,201,'criar evolução clínica estruturada');
if(!validClinical.body?.templateId||!Array.isArray(validClinical.body?.medicoesClinicas)||validClinical.body.medicoesClinicas.length<4) {
  throw new Error('evolução estruturada não retornou template e medições esperados');
}
await assertHealth('health após evolução clínica válida');

const scales=await json('/api/escala',{headers});
expectStatus(scales.res.status,200,'listar escala');
const firstScale=scales.body?.data?.[0];
if(!firstScale) throw new Error('base demonstrativa sem escala');
const duplicateScale=await json('/api/escala',{
  method:'POST',headers,
  body:JSON.stringify({profissionalId:firstScale.profissionalId,data:String(firstScale.data).slice(0,10),turno:firstScale.turno}),
});
expectStatus(duplicateScale.res.status,409,'plantão duplicado');
await assertHealth('health após erro de regra na escala');

console.log('API resiliente: validações e conflitos retornam HTTP sem derrubar o processo.');
