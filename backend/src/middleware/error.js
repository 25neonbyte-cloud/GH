export function notFound(req, res) { res.status(404).json({ error: 'Rota não encontrada' }); }
export function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || (err.code === 'P2002' ? 409 : 500);
  res.status(status).json({
    error: err.message || 'Erro interno do servidor',
    code: err.code || 'INTERNAL_ERROR',
    ...(err.details ? { details: err.details } : {}),
  });
}
