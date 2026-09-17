import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { assert } from '../utils/validation.js';

const router = Router();
const signUser = user => jwt.sign({ sub: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  assert(username && password, 'Usuário e senha são obrigatórios');
  const user = await prisma.usuario.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } });
  if (!user?.ativo || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Credenciais inválidas' });
  const { password: _, ...safe } = user;
  res.json({ token: signUser(user), user: safe });
});

router.post('/refresh', authenticate, (req, res) => {
  if (req.user.role === 'TV') return res.status(403).json({ error: 'Não suportado para TV' });
  res.json({ token: signUser(req.user) });
});
router.post('/logout', authenticate, (req, res) => res.status(204).end());

router.post('/tv', (req, res) => {
  if (!process.env.TV_PASSWORD || req.body.password !== process.env.TV_PASSWORD) return res.status(401).json({ error: 'Senha do modo TV inválida' });
  const token = jwt.sign({ scope: 'tv' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

export default router;
