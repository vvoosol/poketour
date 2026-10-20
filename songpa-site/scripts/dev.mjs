import { build } from './build.mjs';
import { startLocalServer } from './local-server.mjs';

if (process.env.NODE_ENV === 'production') throw Error('This loopback-only development server cannot run in production.');
const preview = process.argv.includes('--preview');
const port = Number(process.env.POKETOUR_PORT || 5173);
const userId = process.env.POKETOUR_DEV_USER || 'local-developer';
if (!preview) await build();
const runtime = await startLocalServer({ port, userId });
console.log(`Local: ${runtime.origin}`);
console.log(`Local development identity: ${userId}; database: ${runtime.dbFile}`);
console.log('Edit source files, then restart npm run dev to rebuild. Ctrl+C stops the server.');
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  if (closing) return;
  closing = true;
  await runtime.close();
  process.exit(0);
});
