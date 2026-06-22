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

  // Search candidates per marketplace without saving (top 3 per source)
  app.get<{ Params: { id: string } }>('/api/items/:id/candidates', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });

    const item = itemsDb.findById(id);
    if (!item) return reply.code(404).send({ error: 'Item não encontrado' });

    const searchQuery = await refineSearchQuery(item.name, item.description);

    const settled = await Promise.allSettled(
      adapters.map((adapter) =>
        Promise.race([
          adapter.search(searchQuery),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 25000),
          ),
        ]),
      ),
    );

    const candidates: Record<string, object[]> = {};
    settled.forEach((result, index) => {
      const source = adapters[index].name;
      if (result.status === 'fulfilled') {
        const top3 = filterAndRank(result.value, searchQuery, 3);
        if (top3.length > 0) candidates[source] = top3;
      }
    });

    return { search_query: searchQuery, candidates };
  });

  // Save user-selected products as quotations (no screenshot at this step)
  app.post<{
    Params: { id: string };
    Body: {
      products: Array<{
        source: string;
        title: string;
        price: number | null;
        currency: string;
        product_url: string;
      }>;
    };
  }>('/api/items/:id/quotations/bulk', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });
    if (!itemsDb.findById(id)) return reply.code(404).send({ error: 'Item não encontrado' });

    let saved = 0;
    for (const p of req.body.products) {
      quotationsDb.create({
        item_id: id,
        source: p.source,
        title: p.title,
        price: p.price,
        currency: p.currency ?? 'BRL',
        product_url: p.product_url,
      });
      saved++;
    }

    return { saved };
  });

  // Delete a single quotation
  app.delete<{ Params: { id: string } }>('/api/quotations/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });
    const deleted = quotationsDb.deleteOne(id);
    if (!deleted) return reply.code(404).send({ error: 'Cotação não encontrada' });
    reply.code(204);
  });

  // Update price / url of a quotation
  app.patch<{ Params: { id: string }; Body: { price?: number | null; product_url?: string } }>(
    '/api/quotations/:id',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });
      const updated = quotationsDb.update(id, req.body);
      if (!updated) return reply.code(404).send({ error: 'Cotação não encontrada' });
      return updated;
    },
  );
}
