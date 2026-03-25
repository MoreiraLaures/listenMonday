const { EQUIV } = require('../config');
const { ID2FIELD, FIELD2ID } = require('./mapping');
const { cleanText, isDateLike, coerceBool, statusToIndex } = require('../utils/formatters');

const NUMERIC_FIELDS = ['Valor_Pedido', 'Valor_frete_pied', 'Valor_frete_faturado', 'Saldo_de_Frete'];
const DATE_FIELDS    = ['Data_SEP', 'Data_Coleta', 'Preve_Entrega'];
const BOOL_FIELDS    = ['Infull', 'Ontime'];

function buildUpdateMultipleColumnsMutation(boardId, colIdDict, rowId) {
  const payloadEsc = JSON.stringify(colIdDict).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `mutation { change_multiple_column_values(item_id: ${rowId}, board_id: ${boardId}, column_values: "${payloadEsc}") { id } }`;
}

function buildCreateItemMutation(boardId, itemName, colIdDict) {
  const payloadEsc = JSON.stringify(colIdDict).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const nameEsc = String(itemName).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `mutation { create_item(board_id: ${boardId}, item_name: "${nameEsc}", column_values: "${payloadEsc}") { id name } }`;
}

function buildColumnValuesFromRow(row) {
  const colvals = {};
  for (const [dbCol, mondayName] of Object.entries(EQUIV)) {
    if (!(mondayName in FIELD2ID)) continue;
    const colId = FIELD2ID[mondayName];
    if (!(dbCol in row) || row[dbCol] == null) continue;
    const raw = row[dbCol];

    if (mondayName === 'status') {
      const idx = statusToIndex(raw);
      if (idx !== null) colvals[colId] = { index: idx };
      continue;
    }
    if (BOOL_FIELDS.includes(mondayName)) {
      const b = coerceBool(raw);
      if (b !== null) colvals[colId] = { checked: b };
      continue;
    }
    if (DATE_FIELDS.includes(mondayName)) {
      const val = cleanText(raw);
      if (isDateLike(val)) colvals[colId] = { date: val };
      continue;
    }
    if (mondayName === 'Prazo') {
      const txt = cleanText(String(raw));
      const m = txt.match(/^\s*(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})\s*$/);
      if (m) colvals[colId] = { from: m[1], to: m[2] };
      continue;
    }
    if (NUMERIC_FIELDS.includes(mondayName)) {
      const val = String(raw).replace(/[^0-9.\-]/g, '');
      if (val !== '') colvals[colId] = val;
      continue;
    }
    const val = cleanText(raw);
    if (val !== '') colvals[colId] = val;
  }
  return colvals;
}

function mondayColumnsToFriendlyMap(itemJson) {
  const out = {};
  if (!itemJson) return out;
  for (const cv of (itemJson.column_values ?? [])) {
    if (cv.id in ID2FIELD) out[ID2FIELD[cv.id]] = cv.text || cv.value || '';
  }
  out.code = itemJson.name;
  return out;
}

module.exports = { buildUpdateMultipleColumnsMutation, buildCreateItemMutation, buildColumnValuesFromRow, mondayColumnsToFriendlyMap };
