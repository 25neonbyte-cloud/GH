export function assert(condition, message, status = 400, code = 'VALIDATION_ERROR', details) {
  if (!condition) {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    error.details = details;
    throw error;
  }
}

export function senhaForte(password) {
  return typeof password === 'string' && password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function cpfBasico(cpf) {
  if (!cpf) return true;
  const digits = String(cpf).replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (base, factor) => {
    let sum = 0;
    for (const digit of base) sum += Number(digit) * factor--;
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(digits.slice(0, 9), 10) === Number(digits[9]) && calc(digits.slice(0, 10), 11) === Number(digits[10]);
}

export function parseDate(value, name, { required = false, allowFuture = true } = {}) {
  if (!value && !required) return null;
  assert(value, `${name} é obrigatório`);
  const date = new Date(value);
  assert(!Number.isNaN(date.getTime()), `${name} inválida`);
  if (!allowFuture) assert(date <= new Date(), `${name} não pode ser futura`);
  return date;
}
