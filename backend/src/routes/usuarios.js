import { createRouter } from '../utils/asyncRouter.js'; import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { adminOnly } from '../middleware/permissions.js';
import { assert, senhaForte } from '../utils/validation.js';

const router = createRouter();
router.use(authenticate, adminOnly);
const safeSelect = { id: true, username: true, nome: true, cargo: true, role: true, permissoes: true, ativo: true, createdAt: true, updatedAt: true };

router.get('/', async (req, res) => {
  const search = req.query.search || '';
  const data = await prisma.usuario.findMany({ where: search ? { OR: [{ nome: { contains: search, mode: 'insensitive' } }, { username: { contains: search, mode: 'insensitive' } }] } : {}, select: safeSelect, orderBy: { nome: 'asc' } });
  res.json({ data });
});

router.post('/', async (req, res) => {
  const { username, password, nome, cargo, role = 'USER', permissoes = {} } = req.body;
  assert(username && nome, 'Username e nome são obrigatórios');
  assert(senhaForte(password), 'Senha deve ter no mínimo 8 caracteres, com letra e número');
  const exists = await prisma.usuario.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } });
  assert(!exists, 'Username já cadastrado', 409, 'DUPLICATE_USERNAME');
  const user = await prisma.usuario.create({ data: { username, password: await bcrypt.hash(password, 10), nome, cargo, role, permissoes }, select: safeSelect });
  res.status(201).json(user);
});

router.put('/:id', async (req, res) => {
  const { username, password, nome, cargo, role, permissoes, ativo } = req.body;
  if (password !== undefined) assert(senhaForte(password), 'Senha deve ter no mínimo 8 caracteres, com letra e número');
  if (username) {
    const exists = await prisma.usuario.findFirst({ where: { username: { equals: username, mode: 'insensitive' }, NOT: { id: req.params.id } } });
    assert(!exists, 'Username já cadastrado', 409);
  }
  const data = { ...(username !== undefined && { username }), ...(nome !== undefined && { nome }), ...(cargo !== undefined && { cargo }), ...(role !== undefined && { role }), ...(permissoes !== undefined && { permissoes }), ...(ativo !== undefined && { ativo }) };
  if (password) data.password = await bcrypt.hash(password, 10);
  const user = await prisma.usuario.update({ where: { id: req.params.id }, data, select: safeSelect });
  res.json(user);
});

router.delete('/:id', async (req, res) => {
  await prisma.usuario.update({ where: { id: req.params.id }, data: { ativo: false } });
  res.status(204).end();
});
export default router;
