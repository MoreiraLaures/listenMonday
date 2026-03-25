const { Client } = require('pg');
const { DB_CFG, VIEW_SQL, VIEW_SQL_FINAL } = require('../config');

async function connectDb() {
  const client = new Client(DB_CFG);
  await client.connect();
  return client;
}

async function fetchRowFromView(client, code) {
  const res = await client.query(VIEW_SQL, [code]);
  return res.rows[0] ?? null;
}

async function fetchRowFromViewFinal(client, code) {
  const res = await client.query(VIEW_SQL_FINAL, [code]);
  return res.rows[0] ?? null;
}

module.exports = { connectDb, fetchRowFromView, fetchRowFromViewFinal };
