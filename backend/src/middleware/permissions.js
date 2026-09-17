export function checkPermission(module, action) {
  return (req, res, next) => {
    if (req.user?.role === 'ADMIN') return next();
    const permissions = req.user?.permissoes?.[module] || [];
    if (!permissions.includes(action)) return res.status(403).json({ error: `Sem permissão para ${action} em ${module}` });
    next();
  };
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  next();
}
