import { createRouter } from '../utils/asyncRouter.js'; import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import { assert, cpfBasico, parseDate } from '../utils/validation.js';

const router = createRouter();
router.use(authenticate);
router.get('/', checkPermission('pacientes', 'read'), async (req, res) => {
  const { search = '', cpf } = req.query;
  const where = { ...(cpf && { cpf }), ...(search && { OR: [{ nome: { contains: search, mode: 'insensitive' } }, { prontuario: { contains: search, mode: 'insensitive' } }, { cpf: { contains: search } }] }) };
  const data = await prisma.paciente.findMany({ where, orderBy: { nome: 'asc' }, include: { internacoes: { where: { status: 'ATIVA' }, include: { leito: true } } } });
  res.json({ data });
});
router.get('/:id', checkPermission('pacientes', 'read'), async (req, res) => {
  const data = await prisma.paciente.findUnique({
    where: { id: req.params.id },
    include: {
      internacoes: { include: { leito: true }, orderBy: { dataInternacao: 'desc' } },
      evolucoes: {
        include: {
          template: true,
          profissional: { select: { id: true, nome: true, cargo: true, registroConselho: true } },
          medicoesClinicas: { orderBy: { observadoEm: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
      problemasClinicos: {
        include: {
          criadoPorProfissional: { select: { nome: true, cargo: true } },
          eventos: { orderBy: { ocorridoEm: 'desc' }, take: 1, include: { profissional: { select: { nome: true, cargo: true } } } },
        },
        orderBy: { iniciadoEm: 'desc' },
      },
      medicoesClinicas: { orderBy: { observadoEm: 'desc' }, take: 100 },
    },
  });
  if (!data) return res.status(404).json({ error: 'Paciente não encontrado' });
  res.json(data);
});
router.post('/', checkPermission('pacientes', 'write'), async (req, res) => {
  const { prontuario, nome, cpf, dataNascimento, sexo, nomeAcompanhante, telefoneContato, diagnostico, precaucoes = [] } = req.body;
  assert(prontuario && nome && dataNascimento, 'Prontuário, nome e data de nascimento são obrigatórios');
  assert(/^\d{6,10}$/.test(String(prontuario)), 'Prontuário deve conter de 6 a 10 dígitos');
  assert(nome.trim().length >= 3, 'Nome deve ter ao menos 3 caracteres');
  assert(cpfBasico(cpf), 'CPF inválido');
  const data = await prisma.paciente.create({ data: { prontuario: String(prontuario), nome: nome.trim(), cpf: cpf ? String(cpf).replace(/\D/g, '') : null, dataNascimento: parseDate(dataNascimento, 'Data de nascimento', { required: true, allowFuture: false }), sexo: sexo || null, nomeAcompanhante, telefoneContato, diagnostico, precaucoes, updatedBy: req.user.username } });
  res.status(201).json(data);
});
router.put('/:id', checkPermission('pacientes', 'write'), async (req, res) => {
  const body = { ...req.body, updatedBy: req.user.username };
  if (body.dataNascimento) body.dataNascimento = parseDate(body.dataNascimento, 'Data de nascimento', { allowFuture: false });
  if (body.cpf !== undefined) { assert(cpfBasico(body.cpf), 'CPF inválido'); body.cpf = body.cpf ? String(body.cpf).replace(/\D/g, '') : null; }
  const data = await prisma.paciente.update({ where: { id: req.params.id }, data: body });
  res.json(data);
});
router.delete('/:id', checkPermission('pacientes', 'delete'), async (req, res) => {
  const active = await prisma.internacao.findFirst({ where: { pacienteId: req.params.id, status: 'ATIVA' } });
  assert(!active, 'Paciente possui internação ativa e não pode ser excluído', 409);
  await prisma.paciente.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
export default router;
