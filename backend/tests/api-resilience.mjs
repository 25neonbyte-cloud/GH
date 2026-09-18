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
