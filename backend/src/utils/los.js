export function calcularLOS(dataInternacao, dataFim = new Date()) {
  const inicio = new Date(dataInternacao);
  const fim = new Date(dataFim);
  const diff = fim.getTime() - inicio.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}
