import { createRouter } from '../utils/asyncRouter.js'; import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import { assert, parseDate } from '../utils/validation.js';
import { dashboardCache } from '../services/dashboardCache.js';

const router = createRouter();
router.use(authenticate);
router.get('/', checkPermission('leitos', 'read'), async (req, res) => {
  const { status, tipo, andar } = req.query;
  const data = await prisma.leito.findMany({ where: { ...(status && { status }), ...(tipo && { tipo }), ...(andar && { andar: Number(andar) }) }, include: { internacoes: { where: { status: 'ATIVA' }, include: { paciente: { select: { id: true, nome: true, prontuario: true } } } }, bloqueios: { where: { ativo: true } } }, orderBy: [{ andar: 'asc' }, { numero: 'asc' }] });
  res.json({ data });
});
router.get('/disponiveis', checkPermission('leitos', 'read'), async (req, res) => {
  const data = await prisma.leito.findMany({ where: { status: 'LIVRE' }, orderBy: [{ andar: 'asc' }, { numero: 'asc' }] });
  res.json({ data });
});
router.post('/', checkPermission('leitos', 'write'), async (req, res) => {
  const { numero, andar, tipo, observacoes } = req.body;
  assert(numero && Number.isInteger(Number(andar)) && tipo, 'Número, andar e tipo são obrigatórios');
  const data = await prisma.leito.create({ data: { numero: String(numero), andar: Number(andar), tipo, observacoes, updatedBy: req.user.username } });
  dashboardCache.invalidate();
  res.status(201).json(data);
});
router.put('/:id', checkPermission('leitos', 'write'), async (req, res) => {
  const { numero, andar, tipo, observacoes } = req.body;
  const data = await prisma.leito.update({ where: { id: req.params.id }, data: { ...(numero !== undefined && { numero: String(numero) }), ...(andar !== undefined && { andar: Number(andar) }), ...(tipo !== undefined && { tipo }), ...(observacoes !== undefined && { observacoes }), updatedBy: req.user.username } });
  res.json(data);
});
router.post('/:id/bloquear', checkPermission('leitos', 'write'), async (req, res) => {
  const { tipo, motivo, dataInicio, dataFim } = req.body;
  assert(['BLOQUEADO', 'MANUTENCAO', 'RESERVADO'].includes(tipo), 'Tipo de bloqueio inválido');
  assert(motivo?.trim(), 'Motivo é obrigatório');
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "leitos" WHERE "id" = ${req.params.id} FOR UPDATE`;
    const leito = await tx.leito.findUnique({ where: { id: req.params.id } });
    assert(leito, 'Leito não encontrado', 404);
    const ativa = await tx.internacao.findFirst({ where: { leitoId: req.params.id, status: 'ATIVA' } });
    assert(!ativa, 'Não é possível bloquear leito com internação ativa. Finalize a internação antes.', 409);
    assert(leito.status === 'LIVRE', `Leito não está livre (Status: ${leito.status})`, 409);
    const bloqueio = await tx.bloqueioLeito.create({ data: { leitoId: req.params.id, tipo, motivo: motivo.trim(), dataInicio: parseDate(dataInicio || new Date(), 'Data de início', { required: true }), dataFim: dataFim ? parseDate(dataFim, 'Data fim') : null, createdBy: req.user.username } });
    await tx.leito.update({ where: { id: req.params.id }, data: { status: tipo, updatedBy: req.user.username } });
    return bloqueio;
  }, { isolationLevel: 'Serializable' });
  dashboardCache.invalidate();
  res.status(201).json(result);
});
router.post('/:id/liberar', checkPermission('leitos', 'write'), async (req, res) => {
  const active = await prisma.bloqueioLeito.findFirst({ where: { leitoId: req.params.id, ativo: true }, orderBy: { createdAt: 'desc' } });
  assert(active, 'Nenhum bloqueio ativo encontrado', 404);
  await prisma.$transaction(async tx => {
    await tx.bloqueioLeito.update({ where: { id: active.id }, data: { ativo: false, liberadoEm: new Date(), liberadoBy: req.user.username } });
    const interna = await tx.internacao.findFirst({ where: { leitoId: req.params.id, status: 'ATIVA' } });
    await tx.leito.update({ where: { id: req.params.id }, data: { status: interna ? 'OCUPADO' : 'LIVRE', updatedBy: req.user.username } });
  });
  dashboardCache.invalidate();
  res.status(204).end();
});
router.delete('/:id', checkPermission('leitos', 'delete'), async (req, res) => {
  const active = await prisma.internacao.findFirst({ where: { leitoId: req.params.id, status: 'ATIVA' } });
  assert(!active, 'Leito possui internação ativa', 409);
  await prisma.leito.delete({ where: { id: req.params.id } });
  dashboardCache.invalidate();
  res.status(204).end();
});
export default router;
