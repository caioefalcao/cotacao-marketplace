import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { registerSearchRoute } from './routes/search.js';
import { registerItemsRoute } from './routes/items.js';
import { registerQuotesRoute } from './routes/quotes.js';
import { magaluAdapter } from './adapters/magalu.js';
import { mercadoLivreAdapter } from './adapters/mercadolivre.js';
import { decathlonAdapter } from './adapters/decathlon.js';
import { centauroAdapter } from './adapters/centauro.js';
import { netshoesAdapter } from './adapters/netshoes.js';
import { closeBrowser } from './utils/browser.js';
import type { SourceAdapter } from './adapters/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = resolve(__dirname, '../../screenshots');
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(fastifyStatic, {
  root: SCREENSHOTS_DIR,
  prefix: '/screenshots/',
});

const adapters: SourceAdapter[] = [
  magaluAdapter,
  mercadoLivreAdapter,
  decathlonAdapter,
  netshoesAdapter,
  centauroAdapter,
];

registerSearchRoute(app, adapters);
await registerItemsRoute(app);
registerQuotesRoute(app, adapters);

const port = Number(process.env.PORT ?? 3000);

app.listen({ port }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Server listening at ${address}`);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  await app.close();
});

process.on('SIGINT', async () => {
  await closeBrowser();
  await app.close();
});
