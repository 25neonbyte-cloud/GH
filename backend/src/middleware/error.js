export function notFound(req, res) { res.status(404).json({ error: 'Rota não encontrada' }); }

export function errorHandler(err, req, res, next) {
  console.error(err);
  let status = err.status || 500;
  let message = err.message || 'Erro interno do servidor';
  let code = err.code || 'INTERNAL_ERROR';

  if (err.code === 'P2002') {
    status = 409;
    code = 'DUPLICATE_VALUE';
    const fields = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : '';
    message = fields ? `Já existe um cadastro com o mesmo valor em: ${fields}` : 'Já existe um cadastro com este valor.';
  } else if (err.code === 'P2025') {
    status = 404;
    message = 'Registro não encontrado.';
  }

  res.status(status).json({
    error: message,
    code,
    ...(err.details ? { details: err.details } : {}),
  });
}
