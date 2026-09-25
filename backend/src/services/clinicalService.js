import { assert } from '../utils/validation.js';

export function categoriaPorCargo(cargo = '') {
  const value = String(cargo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (value.includes('MEDIC')) return 'MEDICA';
  if (value.includes('ENFER')) return 'ENFERMAGEM';
  if (value.includes('FISIO')) return 'FISIOTERAPIA';
  return 'MULTIPROFISSIONAL';
}

export function tipoPorCategoria(categoria) {
  if (categoria === 'MEDICA') return 'MEDICA';
  if (categoria === 'ENFERMAGEM') return 'ENFERMAGEM';
  return 'MULTIPROFISSIONAL';
}

export async function profissionalDoUsuario(prisma, userId) {
  if (!userId) return null;
  return prisma.profissional.findFirst({
    where: { usuarioId: userId },
    select: { id: true, nome: true, cargo: true, registroConselho: true, ativo: true },
  });
}

export function validarConteudoTemplate(template, conteudo = {}) {
  assert(template?.schema && Array.isArray(template.schema.fields), 'Template clínico inválido', 500);
  const fields = template.schema.fields;
  const allowed = new Set(fields.map(field => field.key));
  const clean = {};

  for (const field of fields) {
    let value = conteudo[field.key];

    if (typeof value === 'string') value = value.trim();
    if (value === '') value = null;

    if (field.required) {
      assert(value !== undefined && value !== null, `${field.label} é obrigatório`);
    }

    if (value === undefined || value === null) {
      clean[field.key] = null;
      continue;
    }

    if (field.type === 'number') {
      const number = Number(value);
      assert(Number.isFinite(number), `${field.label} deve ser numérico`);
      if (field.min !== undefined) assert(number >= Number(field.min), `${field.label} deve ser maior ou igual a ${field.min}`);
      if (field.max !== undefined) assert(number <= Number(field.max), `${field.label} deve ser menor ou igual a ${field.max}`);
      clean[field.key] = number;
      continue;
    }

    if (field.type === 'select') {
      assert(Array.isArray(field.options) && field.options.includes(value), `${field.label} possui valor inválido`);
    }

    clean[field.key] = value;
  }

  for (const key of Object.keys(conteudo || {})) {
    assert(allowed.has(key), `Campo clínico não reconhecido: ${key}`);
  }

  return clean;
}

const measurementRules = {
  pa: { label: 'Pressão arterial', unit: 'mmHg', kind: 'pressure' },
  fc: { label: 'Frequência cardíaca', unit: 'bpm', min: 20, max: 250 },
  fr: { label: 'Frequência respiratória', unit: 'irpm', min: 4, max: 80 },
  temp: { label: 'Temperatura', unit: '°C', min: 30, max: 45 },
  spo2: { label: 'SpO₂', unit: '%', min: 1, max: 100 },
  glicemia: { label: 'Glicemia', unit: 'mg/dL', min: 10, max: 1000 },
};

export function normalizarMedicoes(input = {}) {
  const measurements = [];
  for (const [codigo, rule] of Object.entries(measurementRules)) {
    let value = input?.[codigo];
    if (typeof value === 'string') value = value.trim();
    if (value === '' || value === undefined || value === null) continue;

    if (rule.kind === 'pressure') {
      const match = String(value).match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
      assert(match, 'Pressão arterial deve usar o formato sistólica/diastólica, por exemplo 120/80');
      const systolic = Number(match[1]);
      const diastolic = Number(match[2]);
      assert(systolic >= 50 && systolic <= 300, 'Pressão sistólica fora da faixa válida');
      assert(diastolic >= 30 && diastolic <= 200, 'Pressão diastólica fora da faixa válida');
      assert(systolic > diastolic, 'Pressão sistólica deve ser maior que a diastólica');
      measurements.push({ codigo, valorTexto: `${systolic}/${diastolic}`, unidade: rule.unit });
      continue;
    }

    const number = Number(value);
    assert(Number.isFinite(number), `${rule.label} deve ser numérica`);
    assert(number >= rule.min && number <= rule.max, `${rule.label} fora da faixa válida (${rule.min}–${rule.max} ${rule.unit})`);
    measurements.push({ codigo, valorNumerico: number, unidade: rule.unit });
  }
  return measurements;
}

export function sinaisVitaisLegado(measurements = []) {
  const result = {};
  for (const item of measurements) {
    result[item.codigo] = item.valorTexto ?? item.valorNumerico ?? null;
  }
  return result;
}

export function legacyFields(conteudo = {}) {
  return {
    queixas: conteudo.queixaPrincipal || conteudo.avaliacao || null,
    condutaMedica: conteudo.conduta || conteudo.condutaFisio || conteudo.plano || null,
    observacoes: conteudo.observacao || conteudo.evolucao || 'Evolução estruturada registrada.',
  };
}
