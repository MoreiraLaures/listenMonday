const { BOARD_ID, EQUIV, MAP_TTL_SEC } = require('../config');
const { fetchBoardCodeToIdMap, fetchItemColumns, httpPostMonday } = require('./client');
const { buildCreateItemMutation, buildUpdateMultipleColumnsMutation, buildColumnValuesFromRow, mondayColumnsToFriendlyMap } = require('./mutations');
const { normalizeForCompare, formatForMonday } = require('../utils/formatters');
const { fetchRowFromView, fetchRowFromViewFinal } = require('../db/client');

const codeIdCache = { ts: 0, map: {} };

async function getCodeIdMap() {
  const now = Date.now() / 1000;
  if (now - codeIdCache.ts > MAP_TTL_SEC || Object.keys(codeIdCache.map).length === 0) {
    const m = await fetchBoardCodeToIdMap(BOARD_ID);
    codeIdCache.map = m;
    codeIdCache.ts = now;
    console.log(`[monday.map] loaded ${Object.keys(m).length} items`);
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
          console.log('[create.err]', codeStr, resp.errors);
        } else {
          const newId = resp?.data?.create_item?.id;
          console.log('[create.ok]', codeStr, newId);
          await refreshCodeIdMap();
        }
      } catch (e) {
        console.log('[create.ex]', codeStr, String(e).slice(0, 200));
      }
      return;
    }

    const itemJson = await fetchItemColumns(itemId);
    const rowMon = mondayColumnsToFriendlyMap(itemJson);
    const updates = computeUpdatePayload(row, rowMon);
    if (!Object.keys(updates).length) {
      console.log('[update.skip]', codeStr, '(sem diferenças)');
      return;
    }
    const mut = buildUpdateMultipleColumnsMutation(BOARD_ID, updates, itemId);
    try {
      const resp = await httpPostMonday(mut);
      if (resp.errors) {
        console.log('[upd.err]', codeStr, resp.errors);
      } else {
        console.log('[upd.ok]', codeStr, Object.keys(updates));
      }
    } catch (e) {
      console.log('[upd.ex]', codeStr, String(e).slice(0, 200));
    }
    return;
  }

  if (itemId) {
    console.log(`[final.lookup] code=${codeStr} não está no view principal; checando finalizados/recusados`);
    const rowFinal = await fetchRowFromViewFinal(dbClient, codeStr);
    if (!rowFinal) {
      console.log(`[notfound.any] code=${codeStr} não está em nenhum view`);
      return;
    }
    const itemJson = await fetchItemColumns(itemId);
    const rowMon = mondayColumnsToFriendlyMap(itemJson);
    const updates = computeUpdatePayload(rowFinal, rowMon);
    if (!Object.keys(updates).length) {
      console.log('[update.skip]', codeStr, '(sem diferenças no finalizado)');
      return;
    }
    const mut = buildUpdateMultipleColumnsMutation(BOARD_ID, updates, itemId);
    try {
      const resp = await httpPostMonday(mut);
      if (resp.errors) {
        console.log('[upd.err.final]', codeStr, resp.errors);
      } else {
        console.log('[final.update]', codeStr, Object.keys(updates));
      }
    } catch (e) {
      console.log('[upd.ex.final]', codeStr, String(e).slice(0, 200));
    }
    return;
  }

  console.log(`[event.skip] code=${codeStr} sem item no Monday e fora dos views`);
}

module.exports = { getCodeIdMap, refreshCodeIdMap, computeUpdatePayload, processCode };
