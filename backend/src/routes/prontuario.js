import { createRouter } from '../utils/asyncRouter.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import { assert } from '../utils/validation.js';
import {
  categoriaPorCargo,
  legacyFields,
  normalizarMedicoes,
  profissionalDoUsuario,
  sinaisVitaisLegado,
  tipoPorCategoria,
  validarConteudoTemplate,
} from '../services/clinicalService.js';

const router = createRouter();
router.use(authenticate);

async function templateParaUsuario(req, templateId, cargoProfissional) {
  const categoria = categoriaPorCargo(cargoProfissional || req.user.cargo);
  const template = templateId
    ? await prisma.templateEvolucao.findUnique({ where: { id: templateId } })
    : await prisma.templateEvolucao.findFirst({
        where: { categoriaProfissional: categoria, ativo: true },
        orderBy: { versao: 'desc' },
      });

  assert(template?.ativo, 'Template de evolução não encontrado', 404);
  if (req.user.role !== 'ADMIN') {
    assert(template.categoriaProfissional === categoria, 'Template incompatível com a categoria profissional', 403);
  }
  return { template, categoria };
}

router.get('/templates/minha', checkPermission('prontuario', 'read'), async (req, res) => {
  const profissional = await profissionalDoUsuario(prisma, req.user.id);
  const categoria = categoriaPorCargo(profissional?.cargo || req.user.cargo);
  const data = await prisma.templateEvolucao.findMany({
    where: { ativo: true, ...(req.user.role === 'ADMIN' ? {} : { categoriaProfissional: categoria }) },
    orderBy: [{ categoriaProfissional: 'asc' }, { versao: 'desc' }],
  });
  res.json({ categoria, data });
});

router.get('/paciente/:pacienteId/contexto', checkPermission('prontuario', 'read'), async (req, res) => {
  const paciente = await prisma.paciente.findUnique({
    where: { id: req.params.pacienteId },
    select: { id: true, nome: true, prontuario: true, diagnostico: true, precaucoes: true },
  });
  assert(paciente, 'Paciente não encontrado', 404);

  const profissional = await profissionalDoUsuario(prisma, req.user.id);
  const { template, categoria } = await templateParaUsuario(req, req.query.templateId, profissional?.cargo);

  const [internacao, ultimaEstruturada, problemas, medicoes] = await Promise.all([
    prisma.internacao.findFirst({
      where: { pacienteId: paciente.id, status: 'ATIVA' },
      include: { leito: true },
      orderBy: { dataInternacao: 'desc' },
    }),
    prisma.evolucao.findFirst({
      where: { pacienteId: paciente.id, templateId: template.id },
      include: { template: true, profissional: true, medicoesClinicas: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.problemaClinico.findMany({
      where: { pacienteId: paciente.id, status: 'ATIVO' },
      include: {
        criadoPorProfissional: { select: { id: true, nome: true, cargo: true } },
        eventos: { orderBy: { ocorridoEm: 'desc' }, take: 1, include: { profissional: { select: { nome: true, cargo: true } } } },
      },
      orderBy: { iniciadoEm: 'desc' },
    }),
    prisma.medicaoClinica.findMany({
      where: { pacienteId: paciente.id },
      orderBy: { observadoEm: 'desc' },
      take: 100,
    }),
  ]);

  let ultimaEvolucao = ultimaEstruturada;
  if (!ultimaEvolucao && ['MEDICA','ENFERMAGEM'].includes(categoria)) {
    ultimaEvolucao = await prisma.evolucao.findFirst({
      where: { pacienteId: paciente.id, templateId: null, tipo: tipoPorCategoria(categoria) },
      include: { template: true, profissional: true, medicoesClinicas: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  const latest = {};
  const trends = {};
  for (const medicao of medicoes) {
    if (!latest[medicao.codigo]) latest[medicao.codigo] = medicao;
    if (!trends[medicao.codigo]) trends[medicao.codigo] = [];
    if (trends[medicao.codigo].length < 6) trends[medicao.codigo].push(medicao);
  }

  res.json({
    paciente,
    internacao,
    profissional,
    categoria,
    template,
    ultimaEvolucao,
    problemas,
    ultimasMedicoes: latest,
    tendenciasMedicoes: trends,
    timezoneApresentacao: 'America/Sao_Paulo',
  });
});

router.get('/paciente/:pacienteId/timeline', checkPermission('prontuario', 'read'), async (req, res) => {
  const [evolucoes, eventosProblema] = await Promise.all([
    prisma.evolucao.findMany({
      where: { pacienteId: req.params.pacienteId },
      include: {
        template: true,
        internacao: { include: { leito: true } },
        profissional: { select: { id: true, nome: true, cargo: true, registroConselho: true } },
        medicoesClinicas: { orderBy: { observadoEm: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.problemaClinicoEvento.findMany({
      where: { problema: { pacienteId: req.params.pacienteId } },
      include: {
        problema: { select: { id: true, descricao: true, status: true } },
        profissional: { select: { id: true, nome: true, cargo: true } },
      },
      orderBy: { ocorridoEm: 'desc' },
      take: 200,
    }),
  ]);

  const timeline = [
    ...evolucoes.map(item => ({ tipoEvento: 'EVOLUCAO', ocorridoEm: item.createdAt, item })),
    ...eventosProblema.map(item => ({ tipoEvento: 'PROBLEMA', ocorridoEm: item.ocorridoEm, item })),
  ].sort((a, b) => new Date(b.ocorridoEm) - new Date(a.ocorridoEm));

  res.json({ data: timeline });
});

router.get('/paciente/:pacienteId', checkPermission('prontuario', 'read'), async (req, res) => {
  const { tipo } = req.query;
  const data = await prisma.evolucao.findMany({
    where: { pacienteId: req.params.pacienteId, ...(tipo && { tipo }) },
    include: {
      paciente: { select: { nome: true, prontuario: true } },
      internacao: { include: { leito: true } },
      profissional: { select: { id: true, nome: true, cargo: true, registroConselho: true } },
      template: true,
      medicoesClinicas: { orderBy: { observadoEm: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data });
});

router.post('/paciente/:pacienteId', checkPermission('prontuario', 'write'), async (req, res) => {
  const paciente = await prisma.paciente.findUnique({ where: { id: req.params.pacienteId } });
  assert(paciente, 'Paciente não encontrado', 404);

  const profissional = await profissionalDoUsuario(prisma, req.user.id);
  if (req.user.role !== 'ADMIN') assert(profissional?.ativo, 'Seu usuário não está vinculado a um profissional ativo', 409);
  const { template, categoria } = await templateParaUsuario(req, req.body.templateId, profissional?.cargo);
  const conteudo = validarConteudoTemplate(template, req.body.conteudo || {});
  const medicoes = normalizarMedicoes(req.body.medicoesClinicas || req.body.sinaisVitais || {});
  const legado = legacyFields(conteudo);

  const internacao = await prisma.internacao.findFirst({
    where: { pacienteId: paciente.id, status: 'ATIVA' },
    orderBy: { dataInternacao: 'desc' },
  });

  let evolucaoOrigem = null;
  if (req.body.evolucaoOrigemId) {
    evolucaoOrigem = await prisma.evolucao.findUnique({ where: { id: req.body.evolucaoOrigemId } });
    assert(evolucaoOrigem?.pacienteId === paciente.id, 'Evolução de origem inválida', 409);
    assert(evolucaoOrigem.templateId === template.id, 'A evolução anterior pertence a outra ficha profissional', 409);
  }

  const camposHerdados = Array.isArray(req.body.camposHerdados)
    ? req.body.camposHerdados.filter(key => Object.prototype.hasOwnProperty.call(conteudo, key))
    : [];
  assert(camposHerdados.length === 0 || req.body.confirmouHerdados === true, 'Confirme a revisão dos campos herdados antes de registrar a evolução');

  const data = await prisma.$transaction(async tx => {
    const evolucao = await tx.evolucao.create({
      data: {
        pacienteId: paciente.id,
        internacaoId: internacao?.id || null,
        profissionalId: profissional?.id || null,
        templateId: template.id,
        templateVersao: template.versao,
        conteudo,
        evolucaoOrigemId: evolucaoOrigem?.id || null,
        camposHerdados,
        assinadaEm: new Date(),
        sinaisVitais: medicoes.length ? sinaisVitaisLegado(medicoes) : undefined,
        queixas: legado.queixas,
        condutaMedica: legado.condutaMedica,
        medicacoes: req.body.medicacoes || null,
        observacoes: legado.observacoes,
        tipo: tipoPorCategoria(categoria),
        criadoPor: req.user.username,
        criadoPorNome: profissional?.nome || req.user.nome,
        criadoPorCargo: profissional?.cargo || req.user.cargo || 'NAO_INFORMADO',
      },
    });

    if (medicoes.length) {
      await tx.medicaoClinica.createMany({
        data: medicoes.map(item => ({
          ...item,
          pacienteId: paciente.id,
          internacaoId: internacao?.id || null,
          evolucaoId: evolucao.id,
          profissionalId: profissional?.id || null,
          observadoEm: new Date(),
          criadoPor: req.user.username,
        })),
      });
    }

    return tx.evolucao.findUnique({
      where: { id: evolucao.id },
      include: {
        template: true,
        profissional: { select: { id: true, nome: true, cargo: true, registroConselho: true } },
        medicoesClinicas: true,
      },
    });
  });

  res.status(201).json(data);
});

router.post('/paciente/:pacienteId/problemas', checkPermission('prontuario', 'write'), async (req, res) => {
  const descricao = String(req.body.descricao || '').trim();
  assert(descricao.length >= 3, 'Descrição do problema/diagnóstico deve ter ao menos 3 caracteres');

  const paciente = await prisma.paciente.findUnique({ where: { id: req.params.pacienteId } });
  assert(paciente, 'Paciente não encontrado', 404);

  const profissional = await profissionalDoUsuario(prisma, req.user.id);
  if (req.user.role !== 'ADMIN') assert(profissional?.ativo, 'Seu usuário não está vinculado a um profissional ativo', 409);
  const internacao = await prisma.internacao.findFirst({
    where: { pacienteId: paciente.id, status: 'ATIVA' },
    orderBy: { dataInternacao: 'desc' },
  });

  const result = await prisma.$transaction(async tx => {
    const problema = await tx.problemaClinico.create({
      data: {
        pacienteId: paciente.id,
        internacaoId: internacao?.id || null,
        descricao,
        codigo: req.body.codigo ? String(req.body.codigo).trim() : null,
        criadoPorProfissionalId: profissional?.id || null,
        createdBy: req.user.username,
      },
    });

    await tx.problemaClinicoEvento.create({
      data: {
        problemaId: problema.id,
        tipo: 'CRIADO',
        valorNovo: { descricao, status: 'ATIVO' },
        profissionalId: profissional?.id || null,
        criadoPor: req.user.username,
      },
    });

    return problema;
  });

  res.status(201).json(result);
});

router.post('/problemas/:id/confirmar', checkPermission('prontuario', 'write'), async (req, res) => {
  const problema = await prisma.problemaClinico.findUnique({ where: { id: req.params.id } });
  assert(problema, 'Problema clínico não encontrado', 404);
  assert(problema.status === 'ATIVO', 'Somente problemas ativos podem ser confirmados', 409);
  const profissional = await profissionalDoUsuario(prisma, req.user.id);
  if (req.user.role !== 'ADMIN') assert(profissional?.ativo, 'Seu usuário não está vinculado a um profissional ativo', 409);

  const evento = await prisma.problemaClinicoEvento.create({
    data: {
      problemaId: problema.id,
      tipo: 'CONFIRMADO',
      valorAnterior: { status: problema.status },
      valorNovo: { status: problema.status, observacao: req.body.observacao || null },
      profissionalId: profissional?.id || null,
      criadoPor: req.user.username,
    },
    include: { profissional: { select: { nome: true, cargo: true } } },
  });

  res.json(evento);
});

router.post('/problemas/:id/status', checkPermission('prontuario', 'write'), async (req, res) => {
  const novoStatus = String(req.body.status || '').toUpperCase();
  assert(['ATIVO', 'RESOLVIDO'].includes(novoStatus), 'Status clínico inválido');

  const profissional = await profissionalDoUsuario(prisma, req.user.id);
  if (req.user.role !== 'ADMIN') assert(profissional?.ativo, 'Seu usuário não está vinculado a um profissional ativo', 409);
  const result = await prisma.$transaction(async tx => {
    const atual = await tx.problemaClinico.findUnique({ where: { id: req.params.id } });
    assert(atual, 'Problema clínico não encontrado', 404);

    const problema = await tx.problemaClinico.update({
      where: { id: atual.id },
      data: {
        status: novoStatus,
        resolvidoEm: novoStatus === 'RESOLVIDO' ? new Date() : null,
      },
    });

    await tx.problemaClinicoEvento.create({
      data: {
        problemaId: atual.id,
        tipo: novoStatus === 'RESOLVIDO' ? 'RESOLVIDO' : 'REATIVADO',
        valorAnterior: { status: atual.status },
        valorNovo: { status: novoStatus, observacao: req.body.observacao || null },
        profissionalId: profissional?.id || null,
        criadoPor: req.user.username,
      },
    });

    return problema;
  });

  res.json(result);
});

// Compatibilidade: evoluções antigas ainda podem ser corrigidas pelo próprio autor.
// Evoluções estruturadas são imutáveis; uma nova evolução deve ser registrada para preservar a linha do tempo.
router.put('/:id', checkPermission('prontuario', 'write'), async (req, res) => {
  const current = await prisma.evolucao.findUnique({ where: { id: req.params.id } });
  assert(current, 'Evolução não encontrada', 404);
  assert(req.user.role === 'ADMIN' || current.criadoPor === req.user.username, 'Você só pode editar suas próprias evoluções', 403);
  assert(!current.templateId, 'Evoluções estruturadas não são sobrescritas; registre uma nova evolução para preservar o histórico', 409);
  assert(req.body.observacoes?.trim(), 'Observações são obrigatórias');

  const medicoes = normalizarMedicoes(req.body.sinaisVitais || {});
  const allowed = {
    sinaisVitais: medicoes.length ? sinaisVitaisLegado(medicoes) : undefined,
    queixas: req.body.queixas,
    condutaMedica: req.body.condutaMedica,
    medicacoes: req.body.medicacoes,
    observacoes: req.body.observacoes.trim(),
    updatedBy: req.user.username,
  };
  res.json(await prisma.evolucao.update({ where: { id: req.params.id }, data: allowed }));
});

export default router;
