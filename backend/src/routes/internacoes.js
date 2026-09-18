import { createRouter } from '../utils/asyncRouter.js'; import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import { assert, parseDate } from '../utils/validation.js';
import { calcularLOS } from '../utils/los.js';
import { dashboardCache } from '../services/dashboardCache.js';

const router = createRouter();
router.use(authenticate);

router.get('/', checkPermission('internacoes', 'read'), async (req, res) => {
  const { status, pacienteId, leitoId } = req.query;
  const data = await prisma.internacao.findMany({
    where: { ...(status && { status }), ...(pacienteId && { pacienteId }), ...(leitoId && { leitoId }) },
    include: { paciente: true, leito: true },
    orderBy: { dataInternacao: 'desc' },
  });
  res.json({ data: data.map(i => ({ ...i, los: calcularLOS(i.dataInternacao, i.dataAlta || new Date()) })) });
});

router.post('/', checkPermission('internacoes', 'write'), async (req, res) => {
  const { pacienteId, leitoId, dataInternacao, previsaoAlta, observacoesInternacao } = req.body;
  assert(pacienteId && leitoId, 'Paciente e leito são obrigatórios');
  const entrada = parseDate(dataInternacao || new Date(), 'Data de internação', { required: true, allowFuture: false });
  const previsao = previsaoAlta ? parseDate(previsaoAlta, 'Previsão de alta') : null;
  if (previsao) assert(previsao > entrada, 'Previsão de alta deve ser posterior à internação');

  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "leitos" WHERE "id" = ${leitoId} FOR UPDATE`;
      const [paciente, leito] = await Promise.all([
        tx.paciente.findUnique({ where: { id: pacienteId } }),
        tx.leito.findUnique({ where: { id: leitoId } }),
      ]);
      assert(paciente, 'Paciente não encontrado', 404);
      assert(leito, 'Leito não encontrado', 404);
      const dup = await tx.internacao.findFirst({ where: { pacienteId, status: 'ATIVA' }, include: { leito: true } });
      assert(!dup, `Paciente ${paciente.nome} já possui internação ativa no leito ${dup?.leito?.numero || ''}`, 409);
      assert(leito.status === 'LIVRE', `Leito ${leito.numero} não está disponível (Status: ${leito.status})`, 409);
      if (paciente.precaucoes.includes('ISOLAMENTO')) {
        assert(leito.tipo === 'ISOLAMENTO', `Paciente com precaução de ISOLAMENTO requer leito tipo ISOLAMENTO. Leito ${leito.numero} é ${leito.tipo}.`, 409);
      }
      const i = await tx.internacao.create({
        data: { pacienteId, leitoId, dataInternacao: entrada, previsaoAlta: previsao, observacoesInternacao, status: 'ATIVA', createdBy: req.user.username },
        include: { paciente: true, leito: true },
      });
      await tx.leito.update({ where: { id: leitoId }, data: { status: 'OCUPADO', updatedBy: req.user.username } });
      return i;
    }, { isolationLevel: 'Serializable' });
    dashboardCache.invalidate();
    res.status(201).json({ ...result, los: calcularLOS(result.dataInternacao) });
  } catch (e) {
    if (e.code === 'P2002') { e.status = 409; e.message = 'Conflito de internação: paciente ou leito já possui internação ativa'; }
    throw e;
  }
});

router.post('/:id/transferir', checkPermission('internacoes', 'write'), async (req, res) => {
  const { novoLeitoId, motivo = '' } = req.body;
  assert(novoLeitoId, 'Novo leito é obrigatório');

  const result = await prisma.$transaction(async tx => {
    const current = await tx.internacao.findUnique({ where: { id: req.params.id }, include: { paciente: true, leito: true } });
    assert(current, 'Internação não encontrada', 404);
    assert(current.status === 'ATIVA', 'Somente internações ativas podem ser transferidas', 409);
    assert(current.leitoId !== novoLeitoId, 'Selecione um leito diferente do atual', 409);

    await tx.$queryRaw`SELECT "id" FROM "leitos" WHERE "id" IN (${current.leitoId}, ${novoLeitoId}) FOR UPDATE`;
    const novoLeito = await tx.leito.findUnique({ where: { id: novoLeitoId } });
    assert(novoLeito, 'Novo leito não encontrado', 404);
    assert(novoLeito.status === 'LIVRE', `Leito ${novoLeito.numero} não está disponível (Status: ${novoLeito.status})`, 409);
    if (current.paciente.precaucoes.includes('ISOLAMENTO')) {
      assert(novoLeito.tipo === 'ISOLAMENTO', 'Paciente com precaução de isolamento deve permanecer em leito de isolamento', 409);
    }

    const stamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const registro = `[TRANSFERÊNCIA ${stamp}] ${current.leito.numero} → ${novoLeito.numero}${motivo.trim() ? ` · ${motivo.trim()}` : ''}`;
    const observacoesInternacao = [current.observacoesInternacao, registro].filter(Boolean).join('\n');

    const updated = await tx.internacao.update({
      where: { id: current.id },
      data: { leitoId: novoLeito.id, observacoesInternacao },
      include: { paciente: true, leito: true },
    });
    await tx.leito.update({ where: { id: current.leitoId }, data: { status: 'LIVRE', updatedBy: req.user.username } });
    await tx.leito.update({ where: { id: novoLeito.id }, data: { status: 'OCUPADO', updatedBy: req.user.username } });
    return updated;
  }, { isolationLevel: 'Serializable' });

  dashboardCache.invalidate();
  res.json({ ...result, los: calcularLOS(result.dataInternacao) });
});

router.put('/:id/finalizar', checkPermission('internacoes', 'write'), async (req, res) => {
  const alta = parseDate(req.body.dataAlta || new Date(), 'Data de alta', { required: true, allowFuture: false });
  const result = await prisma.$transaction(async tx => {
    const current = await tx.internacao.findUnique({ where: { id: req.params.id } });
    assert(current, 'Internação não encontrada', 404);
    assert(current.status === 'ATIVA', 'Internação já finalizada', 409);
    assert(alta > current.dataInternacao, 'Data de alta deve ser posterior à internação');
    await tx.$queryRaw`SELECT "id" FROM "leitos" WHERE "id" = ${current.leitoId} FOR UPDATE`;
    const changed = await tx.internacao.updateMany({
      where: { id: req.params.id, status: 'ATIVA' },
      data: { dataAlta: alta, observacoesAlta: req.body.observacoesAlta, status: 'FINALIZADA', dataAltaRegistrada: new Date(), altaBy: req.user.username },
    });
    assert(changed.count === 1, 'Internação já foi finalizada por outra operação', 409);
    const i = await tx.internacao.findUnique({ where: { id: req.params.id }, include: { paciente: true, leito: true } });
    const bloqueio = await tx.bloqueioLeito.findFirst({ where: { leitoId: i.leitoId, ativo: true }, orderBy: { createdAt: 'desc' } });
    await tx.leito.update({ where: { id: i.leitoId }, data: { status: bloqueio ? bloqueio.tipo : 'LIVRE', updatedBy: req.user.username } });
    return i;
  }, { isolationLevel: 'Serializable' });
  dashboardCache.invalidate();
  res.json({ ...result, los: calcularLOS(result.dataInternacao, result.dataAlta) });
});

export default router;
