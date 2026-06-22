import type { FastifyInstance } from 'fastify';
import { itemsDb, quotationsDb } from '../db.js';
import { screenshotUrl } from '../utils/screenshot.js';
import { refineSearchQuery } from '../utils/queryRefiner.js';
import { filterAndRank } from '../utils/similarity.js';
import type { SourceAdapter } from '../adapters/types.js';

export function registerQuotesRoute(app: FastifyInstance, adapters: SourceAdapter[]): void {
  // Trigger parallel search + screenshot + save for one item
  app.post<{ Params: { id: string } }>('/api/items/:id/quote', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });

    const item = itemsDb.findById(id);
    if (!item) return reply.code(404).send({ error: 'Item não encontrado' });

    const searchQuery = await refineSearchQuery(item.name, item.description);
    app.log.info(`[quote] item="${item.name}" → query refinada="${searchQuery}"`);

    const results = await Promise.allSettled(
      adapters.map(async (adapter) => {
        const products = await Promise.race([
          adapter.search(searchQuery),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 50000),
          ),
        ]);

        const top = filterAndRank(products, searchQuery, 1);
        if (!top.length) return null;

        const best = top[0];

        let screenshot: string | undefined;
        try {
          screenshot = await screenshotUrl(best.productUrl, `${adapter.name}-${id}`);
        } catch {
          // screenshot failure is non-fatal
        }

        return quotationsDb.create({
          item_id: id,
          source: adapter.name,
          title: best.title,
          price: best.price,
          currency: best.currency,
          product_url: best.productUrl,
          screenshot_path: screenshot,
        });
      }),
    );

    const saved = results.filter((r) => r.status === 'fulfilled' && r.value !== null).length;
    const errors = results
      .map((r, i) => ({ source: adapters[i].name, r }))
      .filter(({ r }) => r.status === 'rejected')
      .map(({ source, r }) => ({
        source,
        message: r.status === 'rejected' ? String(r.reason) : '',
      }));

    return { saved, errors, search_query: searchQuery };
  });

  // List quotations for an item
  app.get<{ Params: { id: string } }>('/api/items/:id/quotations', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });
    if (!itemsDb.findById(id)) return reply.code(404).send({ error: 'Item não encontrado' });
    return quotationsDb.listByItem(id);
  });
}
