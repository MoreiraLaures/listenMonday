const axios = require('axios');
const { MONDAY_API_TOKEN, MONDAY_URL } = require('../config');

const MONDAY_HEADERS = {
  Authorization: MONDAY_API_TOKEN,
  'Content-Type': 'application/json',
};

async function httpPostMonday(query, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const r = await axios.post(MONDAY_URL, { query }, { headers: MONDAY_HEADERS, timeout: 30000 });
    if (r.status === 200) return r.data;
    if (attempt === maxRetries) throw new Error(`Monday HTTP ${r.status}: ${String(r.data).slice(0, 300)}`);
    await new Promise(res => setTimeout(res, 300000));
  }
}


async function fetchBoardCodeToIdMap(boardId) {
  const q = `
    query {
      boards(ids: ${boardId}) {
        items_page(limit: 500) {
          items { id name }
        }
      }
    }
  `;
  const data = await httpPostMonday(q);
  const items = data?.data?.boards?.[0]?.items_page?.items ?? [];
  return Object.fromEntries(
    items.filter(it => it.name).map(it => [String(it.name).trim(), String(it.id)])
  );
}

async function fetchItemColumns(itemId) {
  const q = `
    query {
      items (ids: ${itemId}) {
        id
        name
        column_values { id value text }
      }
    }
  `;
  const data = await httpPostMonday(q);
  const items = data?.data?.items ?? [];
  return items[0] ?? {};
}

module.exports = { httpPostMonday, fetchBoardCodeToIdMap, fetchItemColumns };
