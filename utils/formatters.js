const { FIELD2ID, STATUS_LABELS_TO_INDEX, STATUS_SYNONYMS } = require('../monday/mapping');

const NUMERIC_FIELDS = ['Valor_Pedido', 'Valor_frete_pied', 'Valor_frete_faturado', 'Saldo_de_Frete'];
const DATE_FIELDS    = ['Data_SEP', 'Data_Coleta', 'Preve_Entrega'];
const BOOL_FIELDS    = ['Infull', 'Ontime'];

function normalizeAsciiUpper(s) {
  if (s == null) return '';
  return String(s).normalize('NFKD').replace(/[^\x00-\x7F]/g, '').trim().toUpperCase();
}

function coerceBool(v) {
  if (typeof v === 'boolean') return v;
  if (v == null) return null;
  if (typeof v === 'number') return Boolean(v);

  let s = String(v).trim();
  if (s.startsWith('{') && s.includes('checked')) {
    try {
      const j = JSON.parse(s);
      if (j !== null && typeof j === 'object' && 'checked' in j) return Boolean(j.checked);
    } catch {}
  }

  s = s.normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (['1', 'true', 'sim', 's', 'yes', 'y', 'v', 'ok', 't', 'on'].includes(s)) return true;
  if (['0', 'false', 'nao', 'n', 'no', 'f', 'off'].includes(s)) return false;
  return null;
}

function statusToIndex(value) {
  if (value == null || String(value).trim() === '') return null;
  const v = String(value).trim();
  if (v in STATUS_LABELS_TO_INDEX) return STATUS_LABELS_TO_INDEX[v];
  const vNorm = normalizeAsciiUpper(v);
  const canon = STATUS_SYNONYMS[vNorm];
  if (canon && canon in STATUS_LABELS_TO_INDEX) return STATUS_LABELS_TO_INDEX[canon];
  if (vNorm in STATUS_LABELS_TO_INDEX) return STATUS_LABELS_TO_INDEX[vNorm];
  return null;
}

function isDateLike(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s));
}

function cleanText(txt) {
  if (!txt) return '';
  if (typeof txt === 'string' && txt.startsWith('{') && txt.includes(':')) {
    try {
      const data = JSON.parse(txt);
      if ('date' in data) return data.date;
      if ('from' in data && 'to' in data) return `${data.from} → ${data.to}`;
      if ('checked' in data) return String(data.checked);
    } catch {}
  }
  let s = String(txt);
  s = s.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
  s = s.replace(/[^A-Za-z0-9\s:/\-→]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s.replace(/\[/g, '');
}

function normalizeForCompare(mondayName, value) {
  if (value == null || value === '') return '';
  if (NUMERIC_FIELDS.includes(mondayName)) return String(value).replace(/[^0-9.\-]/g, '');
  if (DATE_FIELDS.includes(mondayName)) {
    const v = cleanText(value);
    return isDateLike(v) ? v : '';
  }
  if (mondayName === 'Prazo') {
    const v = cleanText(value);
    const m = v.match(/^\s*(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})\s*$/);
    return m ? `${m[1]}→${m[2]}` : '';
  }
  if (mondayName === 'status') return normalizeAsciiUpper(value);
  if (BOOL_FIELDS.includes(mondayName)) return coerceBool(value) ? '1' : '0';
  return cleanText(value);
}

function formatForMonday(mondayName, rawValue) {
  if (mondayName === 'status') {
    const idx = statusToIndex(rawValue);
    return idx !== null ? [FIELD2ID[mondayName], { index: idx }] : [null, null];
  }
  if (BOOL_FIELDS.includes(mondayName)) {
    const b = coerceBool(rawValue);
    return b !== null ? [FIELD2ID[mondayName], { checked: b }] : [null, null];
  }
  if (DATE_FIELDS.includes(mondayName)) {
    const v = cleanText(rawValue);
    return isDateLike(v) ? [FIELD2ID[mondayName], { date: v }] : [null, null];
  }
  if (mondayName === 'Prazo') {
    const v = cleanText(rawValue);
    const m = v.match(/^\s*(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})\s*$/);
    return m ? [FIELD2ID[mondayName], { from: m[1], to: m[2] }] : [null, null];
  }
  if (NUMERIC_FIELDS.includes(mondayName)) {
    const v = String(rawValue).replace(/[^0-9.\-]/g, '');
    return v !== '' ? [FIELD2ID[mondayName], v] : [null, null];
  }
  const v = cleanText(rawValue);
  return v !== '' ? [FIELD2ID[mondayName], v] : [null, null];
}

module.exports = { normalizeAsciiUpper, coerceBool, statusToIndex, isDateLike, cleanText, normalizeForCompare, formatForMonday };
