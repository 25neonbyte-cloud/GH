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
  body:JSON.stringify({nome:'Duplicado Teste',registroConselho:firstPro.registroConselho,cargo:'ENFERMEIRO',departamentoPrincipalId:firstPro.departamentoPrincipalId}),
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

const inheritedWithoutConfirmation=await json('/api/prontuario/paciente/'+clinicalPatient.id,{
  method:'POST',headers,
  body:JSON.stringify({
    templateId:clinicalTemplate.id,
    conteudo:{observacao:'Conteúdo herdado para validação'},
    evolucaoOrigemId:validClinical.body.id,
    camposHerdados:['observacao'],
  }),
});
expectStatus(inheritedWithoutConfirmation.res.status,400,'herança clínica sem confirmação');
await assertHealth('health após bloqueio de herança não confirmada');

const inheritedConfirmed=await json('/api/prontuario/paciente/'+clinicalPatient.id,{
  method:'POST',headers,
  body:JSON.stringify({
    templateId:clinicalTemplate.id,
    conteudo:{observacao:'Conteúdo herdado confirmado'},
    evolucaoOrigemId:validClinical.body.id,
    camposHerdados:['observacao'],
    confirmouHerdados:true,
  }),
});
expectStatus(inheritedConfirmed.res.status,201,'herança clínica confirmada');

const problemCreated=await json('/api/prontuario/paciente/'+clinicalPatient.id+'/problemas',{
  method:'POST',headers,
  body:JSON.stringify({descricao:'Problema clínico automatizado'}),
});
expectStatus(problemCreated.res.status,201,'criar problema clínico');
const problemId=problemCreated.body?.id;
if(!problemId) throw new Error('problema clínico não retornou id');

const problemConfirmed=await json('/api/prontuario/problemas/'+problemId+'/confirmar',{method:'POST',headers,body:'{}'});
expectStatus(problemConfirmed.res.status,200,'confirmar problema clínico');

const problemResolved=await json('/api/prontuario/problemas/'+problemId+'/status',{
  method:'POST',headers,
  body:JSON.stringify({status:'RESOLVIDO'}),
});
expectStatus(problemResolved.res.status,200,'resolver problema clínico');
await assertHealth('health após fluxo de problema clínico');

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

const triageTemplate=await json('/api/prontuario/triagem/template',{headers});
expectStatus(triageTemplate.res.status,200,'carregar template de triagem');
const triage=await json('/api/prontuario/paciente/'+clinicalPatient.id+'/triagem',{
  method:'POST',headers,
  body:JSON.stringify({
    conteudo:{queixaPrincipal:'Teste automatizado de triagem',origemAtendimento:'CI',classificacaoRisco:'Teste',observacao:'Triagem automatizada'},
    medicoesClinicas:{pa:'118/76',fc:78,fr:18,temp:36.6,spo2:98},
    precaucoes:[],
  }),
});
expectStatus(triage.res.status,201,'registrar triagem estruturada');
if(triage.body?.tipo!=='TRIAGEM')throw new Error('triagem não foi registrada como evento TRIAGEM');

const departments=await json('/api/departamentos',{headers});
expectStatus(departments.res.status,200,'listar departamentos');
const testDepartment=departments.body?.data?.find(x=>x.nome==='CLINICA MÉDICA')||departments.body?.data?.[0];
if(!testDepartment)throw new Error('catálogo de departamentos vazio');

const testPro=await json('/api/profissionais',{
  method:'POST',headers,
  body:JSON.stringify({
    nome:'Profissional CI Afastamento',
    registroConselho:'CI-ESCALA-001',
    cargo:'ENFERMEIRO',
    departamentoPrincipalId:testDepartment.id,
  }),
});
expectStatus(testPro.res.status,201,'criar profissional com departamento');
if(testPro.body?.departamentoPrincipalId!==testDepartment.id)throw new Error('departamento principal não foi persistido');

const today=new Date();
const datePlus=n=>{const d=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()+n));return d.toISOString().slice(0,10)};
const shift1=datePlus(1),shift2=datePlus(3);

for(const date of [shift1,shift2]){
  const created=await json('/api/escala',{
    method:'POST',headers,
    body:JSON.stringify({profissionalId:testPro.body.id,departamentoId:testDepartment.id,data:date,turno:'MANHA'}),
  });
  expectStatus(created.res.status,201,'criar plantão departamental '+date);
}

for(const formato of ['xlsx','pdf']){
  const response=await fetch(base+'/api/escala/exportar?'+new URLSearchParams({
    profissionalId:testPro.body.id,dataInicio:shift1,dataFim:datePlus(7),formato,
  }),{headers:{Authorization:'Bearer '+token}});
  expectStatus(response.status,200,'exportar escala '+formato);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength<100)throw new Error('exportação '+formato+' retornou arquivo vazio');
}

const impact=await json('/api/profissionais/'+testPro.body.id+'/impacto-inativacao?dias=5',{headers});
expectStatus(impact.res.status,200,'calcular impacto de afastamento');
if(impact.body?.escalasPeriodo<2)throw new Error('impacto de afastamento não identificou plantões do período');

const absence=await json('/api/profissionais/'+testPro.body.id+'/inativar',{
  method:'POST',headers,
  body:JSON.stringify({modo:'TEMPORARIA',dias:5,motivo:'Teste CI'}),
});
expectStatus(absence.res.status,200,'registrar afastamento temporário');
if(absence.body?.escalasRemovidas!==2)throw new Error('afastamento temporário não removeu os plantões previstos');

const blockedShift=await json('/api/escala',{
  method:'POST',headers,
  body:JSON.stringify({profissionalId:testPro.body.id,departamentoId:testDepartment.id,data:shift1,turno:'TARDE'}),
});
expectStatus(blockedShift.res.status,409,'bloquear escala durante afastamento');

const alerts=await json('/api/escala/alertas',{headers});
expectStatus(alerts.res.status,200,'listar alertas de escala');
const createdAlert=alerts.body?.data?.find(x=>x.profissionalId===testPro.body.id);
if(!createdAlert)throw new Error('afastamento não gerou alerta de escala');
const markRead=await fetch(base+'/api/escala/alertas/'+createdAlert.id+'/lido',{method:'POST',headers});
expectStatus(markRead.status,204,'marcar alerta como lido');
await assertHealth('health após triagem, exportação e afastamento');

console.log('API resiliente: validações e conflitos retornam HTTP sem derrubar o processo.');
