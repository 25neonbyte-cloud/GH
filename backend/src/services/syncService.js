import xlsx from 'xlsx';
import { prisma } from '../lib/prisma.js';
import { cpfBasico } from '../utils/validation.js';

function sheetRows(workbook,name){const sheet=workbook.Sheets[name];return sheet?xlsx.utils.sheet_to_json(sheet,{defval:null}):[];}
export function previewWorkbook(path){
  const workbook=xlsx.readFile(path); const errors=[];
  const pacientes=sheetRows(workbook,'Pacientes'); const leitos=sheetRows(workbook,'Leitos');
  pacientes.forEach((r,i)=>{if(!r.prontuario)errors.push({aba:'Pacientes',linha:i+2,campo:'prontuario',erro:'Prontuário é obrigatório'});if(!r.nome)errors.push({aba:'Pacientes',linha:i+2,campo:'nome',erro:'Nome é obrigatório'});if(r.cpf&&!cpfBasico(r.cpf))errors.push({aba:'Pacientes',linha:i+2,campo:'cpf',erro:'CPF inválido'});if(!r.data_nascimento)errors.push({aba:'Pacientes',linha:i+2,campo:'data_nascimento',erro:'Data de nascimento é obrigatória'});});
  leitos.forEach((r,i)=>{if(!r.numero)errors.push({aba:'Leitos',linha:i+2,campo:'numero',erro:'Número é obrigatório'});if(r.andar===null)errors.push({aba:'Leitos',linha:i+2,campo:'andar',erro:'Andar é obrigatório'});if(!r.tipo)errors.push({aba:'Leitos',linha:i+2,campo:'tipo',erro:'Tipo é obrigatório'});});
  return {valid:errors.length===0,errors,counts:{pacientes:pacientes.length,leitos:leitos.length},pacientes,leitos};
}
export async function importWorkbook(path,filename,username){
  const preview=previewWorkbook(path); if(!preview.valid){const e=new Error('Planilha contém erros. Corrija antes de importar.');e.status=400;e.details=preview.errors;throw e;}
  const result={pacientes:{importados:0,atualizados:0,erros:[]},leitos:{importados:0,atualizados:0,erros:[]}};
  for(const row of preview.pacientes){try{const where={prontuario:String(row.prontuario)};const existed=await prisma.paciente.findUnique({where});const data={nome:String(row.nome),cpf:row.cpf?String(row.cpf).replace(/\D/g,''):null,dataNascimento:new Date(row.data_nascimento),sexo:row.sexo||null,nomeAcompanhante:row.nome_acompanhante||null,telefoneContato:row.telefone||null,diagnostico:row.diagnostico||null,precaucoes:row.precaucoes?String(row.precaucoes).split(',').map(v=>v.trim()).filter(Boolean):[],updatedBy:username};await prisma.paciente.upsert({where,update:data,create:{...data,prontuario:String(row.prontuario)}});result.pacientes[existed?'atualizados':'importados']++;}catch(e){result.pacientes.erros.push({prontuario:row.prontuario,erro:e.message});}}
  for(const row of preview.leitos){try{const where={numero:String(row.numero)};const existed=await prisma.leito.findUnique({where});const data={andar:Number(row.andar),tipo:String(row.tipo).toUpperCase(),observacoes:row.observacoes||null,updatedBy:username};await prisma.leito.upsert({where,update:data,create:{...data,numero:String(row.numero)}});result.leitos[existed?'atualizados':'importados']++;}catch(e){result.leitos.erros.push({numero:row.numero,erro:e.message});}}
  await prisma.logImportacao.create({data:{tipo:'PACIENTES_LEITOS',arquivo:filename,resultado:result,importadoPor:username}});
  return result;
}
export async function exportWorkbook(tipo='TODOS'){
  const wb=xlsx.utils.book_new();
  if(['PACIENTES','TODOS'].includes(tipo)){const rows=(await prisma.paciente.findMany({orderBy:{nome:'asc'}})).map(p=>({prontuario:p.prontuario,nome:p.nome,cpf:p.cpf,data_nascimento:p.dataNascimento.toISOString().slice(0,10),sexo:p.sexo,nome_acompanhante:p.nomeAcompanhante,telefone:p.telefoneContato,diagnostico:p.diagnostico,precaucoes:p.precaucoes.join(', ')}));xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(rows),'Pacientes');}
  if(['LEITOS','TODOS'].includes(tipo)){const rows=(await prisma.leito.findMany({orderBy:[{andar:'asc'},{numero:'asc'}]})).map(l=>({numero:l.numero,andar:l.andar,tipo:l.tipo,status:l.status,observacoes:l.observacoes}));xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(rows),'Leitos');}
  if(['INTERNACOES','TODOS'].includes(tipo)){const rows=(await prisma.internacao.findMany({include:{paciente:true,leito:true},orderBy:{dataInternacao:'desc'}})).map(i=>({prontuario:i.paciente.prontuario,paciente:i.paciente.nome,leito:i.leito.numero,data_internacao:i.dataInternacao.toISOString(),previsao_alta:i.previsaoAlta?.toISOString()||'',data_alta:i.dataAlta?.toISOString()||'',status:i.status,created_by:i.createdBy,alta_by:i.altaBy||''}));xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(rows),'Internacoes');}
  return xlsx.write(wb,{type:'buffer',bookType:'xlsx'});
}
