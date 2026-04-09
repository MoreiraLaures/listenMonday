require('dotenv').config();
const { MONDAY_API_TOKEN, BOARD_ID, MAP_TTL_SEC } = require('./config');
const { connectDb } = require('./db/client');
const { getCodeIdMap, refreshCodeIdMap, reconcileBoard, processCode } = require('./monday/sync');
const { log } = require('./utils/logger');

const RECONCILE_INTERVAL_MS = MAP_TTL_SEC * 1000;

async function runReconcileCycle(dbClient) {
  try {
    await refreshCodeIdMap();
  } catch (e) {
    log('[monday.map.warn] Falha ao carregar map:', String(e).slice(0, 180));
  }
  try {
    await reconcileBoard(dbClient);
  } catch (e) {
    log('[reconcile.ex] Erro durante reconciliação:', String(e).slice(0, 300));
  }
  try {
    await refreshCodeIdMap();
  } catch (e) {
    log('[monday.map.warn] Falha ao recarregar map pós-reconciliação:', String(e).slice(0, 180));
  }
}

async function main() {
  if (!MONDAY_API_TOKEN || !BOARD_ID) {
    throw new Error('Configure MONDAY_API_TOKEN e MONDAY_BOARD_ID no ambiente.');
  }

  const client = await connectDb();
  log("[startup] Conectado ao banco de dados");

  // 1. Carrega map inicial, reconcilia o board e recarrega o map
  log("[startup] Iniciando ciclo de reconciliação inicial...");
  await runReconcileCycle(client);
  log("[startup] Reconciliação inicial concluída. Aguardando eventos no canal 'orders_changed'...");

  // 2. Escuta eventos em tempo real
  client.on('notification', async (msg) => {
    let payload;
    try {
      payload = JSON.parse(msg.payload);
    } catch {
      payload = { raw: msg.payload };
    }
    const code = String(payload.code ?? '').trim();
    if (!code) {
      log("[event.skip] payload sem 'code':", payload);
      return;
    }
    log(`[event] code=${code}`);
    try {
      await processCode(client, code);
    } catch (e) {
      log('[process.ex]', code, String(e).slice(0, 300));
    }
  });

  await client.query('LISTEN orders_changed');

  // 3. Ciclo periódico de reconciliação a cada 10 minutos
  const reconcileTimer = setInterval(async () => {
    log('[reconcile.cycle] Iniciando ciclo periódico de reconciliação...');
    await runReconcileCycle(client);
  }, RECONCILE_INTERVAL_MS);

  process.on('SIGINT', async () => {
    log('\n[shutdown] Encerrando listener.');
    clearInterval(reconcileTimer);
    await client.end();
    process.exit(0);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
