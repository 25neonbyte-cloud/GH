import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.scope === 'tv') {
      req.user = { role: 'TV', username: 'tv', nome: 'Modo TV', cargo: 'DISPLAY', permissoes: { tv: ['read'] } };
      return next();
    }
    const user = await prisma.usuario.findUnique({ where: { id: decoded.sub } });
    if (!user?.ativo) return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function allowTvOrUser(req, res, next) {
  return authenticate(req, res, next);
}
