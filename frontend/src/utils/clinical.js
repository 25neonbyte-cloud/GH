export const CLINICAL_TZ = 'America/Sao_Paulo';

export function fmtBrasilia(value, options = {}) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: CLINICAL_TZ,
    dateStyle: options.dateOnly ? 'short' : 'short',
    ...(options.dateOnly ? {} : { timeStyle: 'short' }),
  });
}

export const measurementLabels = {
  pa: 'PA',
  fc: 'FC',
  fr: 'FR',
  temp: 'Temp',
  spo2: 'SpO₂',
  glicemia: 'Glicemia',
};

export const measurementPlaceholders = {
  pa: '120/80',
  fc: '80',
  fr: '18',
  temp: '36.5',
  spo2: '98',
  glicemia: '100',
};

export const measurementUnits = {
  pa: 'mmHg',
  fc: 'bpm',
  fr: 'irpm',
  temp: '°C',
  spo2: '%',
  glicemia: 'mg/dL',
};

export function emptyClinicalForm(template) {
  const values = {};
  for (const field of template?.schema?.fields || []) values[field.key] = '';
  return values;
}

export function inheritedClinicalForm(template, evolution) {
  const values = emptyClinicalForm(template);
  const inherited = [];
  const previous = evolution?.conteudo || {};
  for (const field of template?.schema?.fields || []) {
    const value = previous[field.key];
    if (value !== undefined && value !== null && value !== '') {
      values[field.key] = value;
      inherited.push(field.key);
    }
  }
  return { values, inherited };
}

export function evolutionLabel(evolution) {
  return evolution?.template?.nome || String(evolution?.tipo || 'Evolução').replaceAll('_', ' ');
}

export function measurementValue(item) {
  if (!item) return '—';
  const value = item.valorTexto ?? item.valorNumerico ?? '—';
  return item.unidade ? `${value} ${item.unidade}` : String(value);
}
