require('dotenv').config();
const { MONDAY_API_TOKEN, BOARD_ID } = require('./config');
const { connectDb } = require('./db/client');
const { getCodeIdMap, processCode } = require('./monday/sync');

async function main() {
  if (!MONDAY_API_TOKEN || !BOARD_ID) {
    throw new Error('Configure MONDAY_API_TOKEN e MONDAY_BOARD_ID no ambiente.');
  }

  const client = await connectDb();
  console.log("LISTEN Aguardando eventos no canal 'orders_changed'");

  try {
    await getCodeIdMap();
  } catch (e) {
    console.log('[monday.map.warn]', String(e).slice(0, 180));
  }

  client.on('notification', async (msg) => {
    let payload;
    try {
      payload = JSON.parse(msg.payload);
    } catch {
      payload = { raw: msg.payload };
    }
    const code = String(payload.code ?? '').trim();
    if (!code) {
      console.log("[event.skip] payload sem 'code':", payload);
      return;
    }
    console.log(`[event] code=${code}`);
    try {
      await processCode(client, code);
    } catch (e) {
      console.log('[process.ex]', code, String(e).slice(0, 300));
    }
  });

  await client.query('LISTEN orders_changed');

  process.on('SIGINT', async () => {
    console.log('\nEncerrando listener.');
    await client.end();
    process.exit(0);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
