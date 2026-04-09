const { BOARD_ID, EQUIV, MAP_TTL_SEC } = require('../config');
const { fetchBoardCodeToIdMap, fetchItemColumns, httpPostMonday } = require('./client');
const { buildCreateItemMutation, buildUpdateMultipleColumnsMutation, buildColumnValuesFromRow, mondayColumnsToFriendlyMap } = require('./mutations');
const { normalizeForCompare, formatForMonday } = require('../utils/formatters');
const { fetchRowFromView, fetchAllFromView, fetchRowFromViewFinal } = require('../db/client');
const { log } = require('../utils/logger');

const codeIdCache = { ts: 0, map: {} };

async function getCodeIdMap() {
  const now = Date.now() / 1000;
  if (now - codeIdCache.ts > MAP_TTL_SEC || Object.keys(codeIdCache.map).length === 0) {
    const m = await fetchBoardCodeToIdMap(BOARD_ID);
    codeIdCache.map = m;
    codeIdCache.ts = now;
    log(`[monday.map] ${Object.keys(m).length} itens carregados do board`);
  }
  return codeIdCache.map;
}

async function refreshCodeIdMap() {
  codeIdCache.ts = 0;
  return getCodeIdMap();
}

function computeUpdatePayload(rowDbDict, rowMonFriendly) {
  const updates = {};
  for (const [dbCol, mondayName] of Object.entries(EQUIV)) {
    if (!(dbCol in rowDbDict)) continue;
    const valDbNorm  = normalizeForCompare(mondayName, rowDbDict[dbCol]);
    const valMonNorm = normalizeForCompare(mondayName, rowMonFriendly[mondayName]);
    if (String(valDbNorm) === String(valMonNorm)) continue;
    const [colId, formatted] = formatForMonday(mondayName, rowDbDict[dbCol]);
    if (colId == null) continue;
    updates[colId] = formatted;
  }
  return updates;
}

async function reconcileBoard(dbClient) {
  log('[reconcile.start] Iniciando reconciliação completa do board...');

  let rows;
  try {
    rows = await fetchAllFromView(dbClient);
  } catch (e) {
    log('[reconcile.err] Falha ao buscar todos os registros da view:', String(e).slice(0, 200));
    return;
  }

  log(`[reconcile.view] ${rows.length} registros encontrados na view`);

  const codeMap = await getCodeIdMap();
  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const code = String(row.code ?? '').trim();
    if (!code) continue;

    const itemId = codeMap[code];

    if (!itemId) {
      const colvals = buildColumnValuesFromRow(row);
      const mut = buildCreateItemMutation(BOARD_ID, code, colvals);
      try {
        const resp = await httpPostMonday(mut);
        if (resp.errors) {
          log('[reconcile.create.err]', code, JSON.stringify(resp.errors).slice(0, 200));
          errors++;
        } else {
          const newId = resp?.data?.create_item?.id;
          log('[reconcile.create.ok]', code, `→ item ${newId}`);
          codeMap[code] = newId;
          created++;
        }
      } catch (e) {
        log('[reconcile.create.ex]', code, String(e).slice(0, 200));
        errors++;
      }
    } else {
      try {
        const itemJson = await fetchItemColumns(itemId);
        const rowMon = mondayColumnsToFriendlyMap(itemJson);
        const updates = computeUpdatePayload(row, rowMon);
        if (!Object.keys(updates).length) {
          skipped++;
          continue;
        }
        const mut = buildUpdateMultipleColumnsMutation(BOARD_ID, updates, itemId);
        const resp = await httpPostMonday(mut);
        if (resp.errors) {
          log('[reconcile.upd.err]', code, JSON.stringify(resp.errors).slice(0, 200));
          errors++;
        } else {
          log('[reconcile.upd.ok]', code, Object.keys(updates));
          updated++;
        }
      } catch (e) {
        log('[reconcile.upd.ex]', code, String(e).slice(0, 200));
        errors++;
      }
    }
  }

  log(`[reconcile.done] total=${rows.length} criados=${created} atualizados=${updated} sem_diff=${skipped} erros=${errors}`);
}

async function processCode(dbClient, codeStr) {
  const codeMap = await getCodeIdMap();
  const itemId = codeMap[codeStr];
  const row = await fetchRowFromView(dbClient, codeStr);

  if (row) {
    if (!itemId) {
      const colvals = buildColumnValuesFromRow(row);
      const mut = buildCreateItemMutation(BOARD_ID, codeStr, colvals);
      try {
        const resp = await httpPostMonday(mut);
        if (resp.errors) {
          log('[create.err]', codeStr, JSON.stringify(resp.errors).slice(0, 200));
        } else {
          const newId = resp?.data?.create_item?.id;
          log('[create.ok]', codeStr, `→ item ${newId}`);
          await refreshCodeIdMap();
        }
      } catch (e) {
        log('[create.ex]', codeStr, String(e).slice(0, 200));
      }
      return;
    }

    const itemJson = await fetchItemColumns(itemId);
    const rowMon = mondayColumnsToFriendlyMap(itemJson);
    const updates = computeUpdatePayload(row, rowMon);
    if (!Object.keys(updates).length) {
      log('[update.skip]', codeStr, '(sem diferenças)');
      return;
    }
    const mut = buildUpdateMultipleColumnsMutation(BOARD_ID, updates, itemId);
    try {
      const resp = await httpPostMonday(mut);
      if (resp.errors) {
        log('[upd.err]', codeStr, JSON.stringify(resp.errors).slice(0, 200));
      } else {
        log('[upd.ok]', codeStr, Object.keys(updates));
      }
    } catch (e) {
      log('[upd.ex]', codeStr, String(e).slice(0, 200));
    }
    return;
  }

  if (itemId) {
    log(`[final.lookup] code=${codeStr} não está no view principal; checando finalizados/recusados`);
    const rowFinal = await fetchRowFromViewFinal(dbClient, codeStr);
    if (!rowFinal) {
      log(`[notfound.any] code=${codeStr} não está em nenhum view`);
      return;
    }
    const itemJson = await fetchItemColumns(itemId);
    const rowMon = mondayColumnsToFriendlyMap(itemJson);
    const updates = computeUpdatePayload(rowFinal, rowMon);
    if (!Object.keys(updates).length) {
      log('[update.skip]', codeStr, '(sem diferenças no finalizado)');
      return;
    }
    const mut = buildUpdateMultipleColumnsMutation(BOARD_ID, updates, itemId);
    try {
      const resp = await httpPostMonday(mut);
      if (resp.errors) {
        log('[upd.err.final]', codeStr, JSON.stringify(resp.errors).slice(0, 200));
      } else {
        log('[final.update]', codeStr, Object.keys(updates));
      }
    } catch (e) {
      log('[upd.ex.final]', codeStr, String(e).slice(0, 200));
    }
    return;
  }

  log(`[event.skip] code=${codeStr} sem item no Monday e fora dos views`);
}

module.exports = { getCodeIdMap, refreshCodeIdMap, computeUpdatePayload, reconcileBoard, processCode };
