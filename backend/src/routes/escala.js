import { createRouter } from '../utils/asyncRouter.js'; import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import { assert, parseDate } from '../utils/validation.js';

const router = createRouter();
router.use(authenticate);
const TURNOS = ['MANHA', 'TARDE', 'NOITE'];

router.get('/', checkPermission('escala', 'read'), async (req, res) => {
  const { dataInicio, dataFim, profissionalId } = req.query;
  const where = { ...(profissionalId && { profissionalId }) };
  if (dataInicio || dataFim) where.data = { ...(dataInicio && { gte: new Date(dataInicio) }), ...(dataFim && { lte: new Date(dataFim) }) };
  const data = await prisma.escala.findMany({ where, include: { profissional: true }, orderBy: [{ data: 'asc' }, { turno: 'asc' }] });
  res.json({ data });
});

router.post('/', checkPermission('escala', 'write'), async (req, res) => {
  const { profissionalId, data, turno } = req.body;
  assert(profissionalId && data && TURNOS.includes(turno), 'Profissional, data e turno são obrigatórios');
  const profissional = await prisma.profissional.findUnique({ where: { id: profissionalId } });
  assert(profissional?.ativo, 'Profissional não encontrado ou inativo', 409);
  const date = parseDate(data, 'Data', { required: true });
  const existing = await prisma.escala.findUnique({ where: { profissionalId_data_turno: { profissionalId, data: date, turno } } });
  assert(!existing, `Profissional ${profissional.nome} já está escalado para ${turno} nesta data`, 409);
  res.status(201).json(await prisma.escala.create({ data: { profissionalId, data: date, turno, updatedBy: req.user.username }, include: { profissional: true } }));
});

router.post('/lote', checkPermission('escala', 'write'), async (req, res) => {
  const { profissionalId, datas = [], turno } = req.body;
  assert(profissionalId && Array.isArray(datas) && datas.length > 0 && TURNOS.includes(turno), 'Profissional, datas e turno são obrigatórios');
  assert(datas.length <= 31, 'Máximo de 31 datas por inclusão em lote');
  const profissional = await prisma.profissional.findUnique({ where: { id: profissionalId } });
  assert(profissional?.ativo, 'Profissional não encontrado ou inativo', 409);

  const criados = [];
  const ignorados = [];
  for (const raw of datas) {
    const data = parseDate(raw, 'Data', { required: true });
    const existing = await prisma.escala.findUnique({ where: { profissionalId_data_turno: { profissionalId, data, turno } } });
    if (existing) {
      ignorados.push(raw);
      continue;
    }
    criados.push(await prisma.escala.create({ data: { profissionalId, data, turno, updatedBy: req.user.username }, include: { profissional: true } }));
  }
  res.status(201).json({ criados, ignorados });
});

router.put('/:id', checkPermission('escala', 'write'), async (req, res) => {
  const current = await prisma.escala.findUnique({ where: { id: req.params.id } });
  assert(current, 'Plantão não encontrado', 404);
  const profissionalId = req.body.profissionalId || current.profissionalId;
  const turno = req.body.turno || current.turno;
  const data = req.body.data ? parseDate(req.body.data, 'Data', { required: true }) : current.data;
  assert(TURNOS.includes(turno), 'Turno inválido');
  const profissional = await prisma.profissional.findUnique({ where: { id: profissionalId } });
  assert(profissional?.ativo, 'Profissional não encontrado ou inativo', 409);
  const duplicate = await prisma.escala.findFirst({ where: { profissionalId, data, turno, NOT: { id: req.params.id } } });
  assert(!duplicate, `Profissional ${profissional.nome} já está escalado para ${turno} nesta data`, 409);
  const updated = await prisma.escala.update({ where: { id: req.params.id }, data: { profissionalId, data, turno, updatedBy: req.user.username }, include: { profissional: true } });
  res.json(updated);
});

router.delete('/:id', checkPermission('escala', 'delete'), async (req, res) => {
  await prisma.escala.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
