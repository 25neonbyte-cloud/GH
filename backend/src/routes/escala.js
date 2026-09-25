import { createRouter } from '../utils/asyncRouter.js';
import xlsx from 'xlsx';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import { assert, parseDate } from '../utils/validation.js';

const router = createRouter();
router.use(authenticate);
const TURNOS = ['MANHA', 'TARDE', 'NOITE'];
const turnoLabel={MANHA:'Manhã',TARDE:'Tarde',NOITE:'Noite'};

async function assertDepartamento(id){
  if(!id)return null;
  const dep=await prisma.departamento.findUnique({where:{id}});
  assert(dep?.ativo,'Departamento não encontrado ou inativo',400);
  return dep;
}

async function assertDisponivel(profissionalId,data){
  const indisponibilidade=await prisma.indisponibilidadeProfissional.findFirst({
    where:{
      profissionalId,
      ativo:true,
      inicio:{lte:data},
      OR:[{fim:null},{fim:{gte:data}}],
    },
  });
  assert(!indisponibilidade,'Profissional indisponível/afastado nesta data',409);
}

function exportRows(items){
  return items.map(x=>({
    Data:new Date(x.data).toLocaleDateString('pt-BR',{timeZone:'UTC'}),
    'Dia da semana':new Date(x.data).toLocaleDateString('pt-BR',{weekday:'long',timeZone:'UTC'}),
    Turno:turnoLabel[x.turno]||x.turno,
    Profissional:x.profissional?.nome||'',
    Registro:x.profissional?.registroConselho||'',
    Função:x.profissional?.cargo||'',
    Departamento:x.departamento?.nome||x.profissional?.departamentoPrincipal?.nome||'',
  }));
}

router.get('/alertas', checkPermission('escala','write'), async(req,res)=>{
  const data=await prisma.alertaEscala.findMany({
    where:{NOT:{lidoPor:{has:req.user.username}}},
    include:{profissional:{select:{id:true,nome:true,cargo:true}}},
    orderBy:{createdAt:'desc'},
    take:20,
  });
  res.json({data});
});

router.post('/alertas/:id/lido', checkPermission('escala','write'), async(req,res)=>{
  const alerta=await prisma.alertaEscala.findUnique({where:{id:req.params.id}});
  assert(alerta,'Alerta não encontrado',404);
  if(!alerta.lidoPor.includes(req.user.username)){
    await prisma.alertaEscala.update({where:{id:alerta.id},data:{lidoPor:{push:req.user.username}}});
  }
  res.status(204).end();
});

router.get('/exportar', checkPermission('escala','read'), async(req,res)=>{
  const {profissionalId,dataInicio,dataFim,departamentoId,formato='xlsx'}=req.query;
  assert(profissionalId&&dataInicio&&dataFim,'Profissional e período são obrigatórios');
  assert(['xlsx','pdf'].includes(String(formato).toLowerCase()),'Formato inválido');

  const inicio=parseDate(dataInicio,'Data inicial',{required:true});
  const fim=parseDate(dataFim,'Data final',{required:true});
  assert(fim>=inicio,'Data final deve ser igual ou posterior à inicial');

  const profissional=await prisma.profissional.findUnique({
    where:{id:profissionalId},
    include:{departamentoPrincipal:true},
  });
  assert(profissional,'Profissional não encontrado',404);

  const items=await prisma.escala.findMany({
    where:{
      profissionalId,
      data:{gte:inicio,lte:fim},
      ...(departamentoId&&{departamentoId}),
    },
    include:{profissional:{include:{departamentoPrincipal:true}},departamento:true},
    orderBy:[{data:'asc'},{turno:'asc'}],
  });
  const rows=exportRows(items);
  const safeName=profissional.nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
  const baseName=`escala-${safeName}-${String(dataInicio).slice(0,10)}-a-${String(dataFim).slice(0,10)}`;

  if(String(formato).toLowerCase()==='xlsx'){
    const wb=xlsx.utils.book_new();
    const ws=xlsx.utils.json_to_sheet(rows.length?rows:[{
      Data:'', 'Dia da semana':'', Turno:'', Profissional:profissional.nome,
      Registro:profissional.registroConselho, Função:profissional.cargo,
      Departamento:profissional.departamentoPrincipal?.nome||'',
    }]);
    xlsx.utils.book_append_sheet(wb,ws,'Escala');
    const buffer=xlsx.write(wb,{type:'buffer',bookType:'xlsx'});
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${baseName}.xlsx"`);
    return res.send(buffer);
  }

  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`attachment; filename="${baseName}.pdf"`);
  const doc=new PDFDocument({size:'A4',margin:42});
  doc.pipe(res);
  doc.fontSize(16).text('Escala profissional',{align:'center'});
  doc.moveDown(0.5);
  doc.fontSize(11).text(profissional.nome,{align:'center'});
  doc.fontSize(9).fillColor('#555555').text(`${profissional.cargo} · ${profissional.registroConselho}`,{align:'center'});
  doc.text(`Período: ${inicio.toLocaleDateString('pt-BR',{timeZone:'UTC'})} a ${fim.toLocaleDateString('pt-BR',{timeZone:'UTC'})}`,{align:'center'});
  doc.fillColor('#000000').moveDown();

  if(!rows.length){
    doc.fontSize(11).text('Nenhum plantão encontrado no período selecionado.');
  }else{
    for(const row of rows){
      if(doc.y>740)doc.addPage();
      doc.fontSize(10).font('Helvetica-Bold').text(`${row.Data} · ${row['Dia da semana']} · ${row.Turno}`);
      doc.font('Helvetica').fontSize(9).text(row.Departamento||'Departamento não informado');
      doc.moveDown(0.45);
    }
  }
  doc.end();
});

router.get('/', checkPermission('escala', 'read'), async (req, res) => {
  const { dataInicio, dataFim, profissionalId, departamentoId } = req.query;
  const where = {
    ...(profissionalId && { profissionalId }),
    ...(departamentoId && { departamentoId }),
  };
  if (dataInicio || dataFim) where.data = { ...(dataInicio && { gte: new Date(dataInicio) }), ...(dataFim && { lte: new Date(dataFim) }) };
  const data = await prisma.escala.findMany({
    where,
    include: {
      profissional:{include:{departamentoPrincipal:true}},
      departamento:true,
    },
    orderBy: [{ data: 'asc' }, { turno: 'asc' }],
  });
  res.json({ data });
});

router.post('/', checkPermission('escala', 'write'), async (req, res) => {
  const { profissionalId, data, turno, departamentoId } = req.body;
  assert(profissionalId && data && TURNOS.includes(turno), 'Profissional, data e turno são obrigatórios');
  const profissional = await prisma.profissional.findUnique({ where: { id: profissionalId }, include:{departamentoPrincipal:true} });
  assert(profissional?.ativo, 'Profissional não encontrado ou inativo', 409);
  const date = parseDate(data, 'Data', { required: true });
  await assertDisponivel(profissionalId,date);
  const depId=departamentoId||profissional.departamentoPrincipalId;
  assert(depId,'Selecione o departamento do plantão');
  await assertDepartamento(depId);
  const existing = await prisma.escala.findUnique({ where: { profissionalId_data_turno: { profissionalId, data: date, turno } } });
  assert(!existing, `Profissional ${profissional.nome} já está escalado para ${turno} nesta data`, 409);
  res.status(201).json(await prisma.escala.create({
    data: { profissionalId, departamentoId:depId, data: date, turno, updatedBy: req.user.username },
    include: { profissional:{include:{departamentoPrincipal:true}}, departamento:true },
  }));
});

router.post('/lote', checkPermission('escala', 'write'), async (req, res) => {
  const { profissionalId, datas = [], turno, departamentoId } = req.body;
  assert(profissionalId && Array.isArray(datas) && datas.length > 0 && TURNOS.includes(turno), 'Profissional, datas e turno são obrigatórios');
  assert(datas.length <= 31, 'Máximo de 31 datas por inclusão em lote');
  const profissional = await prisma.profissional.findUnique({ where: { id: profissionalId }, include:{departamentoPrincipal:true} });
  assert(profissional?.ativo, 'Profissional não encontrado ou inativo', 409);
  const depId=departamentoId||profissional.departamentoPrincipalId;
  assert(depId,'Selecione o departamento do plantão');
  await assertDepartamento(depId);

  const criados = [];
  const ignorados = [];
  const indisponiveis=[];
  for (const raw of datas) {
    const data = parseDate(raw, 'Data', { required: true });
    const unavailable=await prisma.indisponibilidadeProfissional.findFirst({
      where:{profissionalId,ativo:true,inicio:{lte:data},OR:[{fim:null},{fim:{gte:data}}]},
    });
    if(unavailable){indisponiveis.push(raw);continue;}
    const existing = await prisma.escala.findUnique({ where: { profissionalId_data_turno: { profissionalId, data, turno } } });
    if (existing) { ignorados.push(raw); continue; }
    criados.push(await prisma.escala.create({
      data: { profissionalId, departamentoId:depId, data, turno, updatedBy: req.user.username },
      include: { profissional:{include:{departamentoPrincipal:true}}, departamento:true },
    }));
  }
  res.status(201).json({ criados, ignorados, indisponiveis });
});

router.put('/:id', checkPermission('escala', 'write'), async (req, res) => {
  const current = await prisma.escala.findUnique({ where: { id: req.params.id } });
  assert(current, 'Plantão não encontrado', 404);
  const profissionalId = req.body.profissionalId || current.profissionalId;
  const turno = req.body.turno || current.turno;
  const data = req.body.data ? parseDate(req.body.data, 'Data', { required: true }) : current.data;
  assert(TURNOS.includes(turno), 'Turno inválido');
  const profissional = await prisma.profissional.findUnique({ where: { id: profissionalId }, include:{departamentoPrincipal:true} });
  assert(profissional?.ativo, 'Profissional não encontrado ou inativo', 409);
  await assertDisponivel(profissionalId,data);
  const depId=req.body.departamentoId||current.departamentoId||profissional.departamentoPrincipalId;
  assert(depId,'Selecione o departamento do plantão');
  await assertDepartamento(depId);
  const duplicate = await prisma.escala.findFirst({ where: { profissionalId, data, turno, NOT: { id: req.params.id } } });
  assert(!duplicate, `Profissional ${profissional.nome} já está escalado para ${turno} nesta data`, 409);
  const updated = await prisma.escala.update({
    where: { id: req.params.id },
    data: { profissionalId, departamentoId:depId, data, turno, updatedBy: req.user.username },
    include: { profissional:{include:{departamentoPrincipal:true}}, departamento:true },
  });
  res.json(updated);
});

router.delete('/:id', checkPermission('escala', 'delete'), async (req, res) => {
  await prisma.escala.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
