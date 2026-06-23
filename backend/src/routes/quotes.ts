import type { FastifyInstance } from 'fastify';
import { itemsDb, quotationsDb } from '../db.js';
import { screenshotUrl } from '../utils/screenshot.js';
import { refineSearchQuery } from '../utils/queryRefiner.js';
import { filterAndRank } from '../utils/similarity.js';
import { refreshProductPrice } from '../utils/priceRefresher.js';
import type { SourceAdapter } from '../adapters/types.js';

export function registerQuotesRoute(app: FastifyInstance, adapters: SourceAdapter[]): void {
  // Trigger parallel search + screenshot + save for one item
  app.post<{ Params: { id: string } }>('/api/items/:id/quote', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });

    const item = itemsDb.findById(id);
    if (!item) return reply.code(404).send({ error: 'Item não encontrado' });

    const queries = await refineSearchQuery(item.name, item.description);
    const searchQuery = queries[0];
    app.log.info(`[quote] item="${item.name}" → queries="${queries.join(' | ')}"`);

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

  // Search candidates per marketplace without saving — runs all AI-refined queries
  app.get<{ Params: { id: string } }>('/api/items/:id/candidates', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });

    const item = itemsDb.findById(id);
    if (!item) return reply.code(404).send({ error: 'Item não encontrado' });

    const queries = await refineSearchQuery(item.name, item.description);
    app.log.info(`[candidates] item="${item.name}" → queries=${JSON.stringify(queries)}`);

    const settled = await Promise.allSettled(
      adapters.map(async (adapter) => {
        // Run all queries for this adapter in parallel
        const perQuery = await Promise.allSettled(
          queries.map((q) =>
            Promise.race([
              adapter.search(q),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), 60000),
              ),
            ]),
          ),
        );

        // Collect top candidates per query, deduplicate by productUrl
        const seen = new Set<string>();
        const pool: object[] = [];
        perQuery.forEach((r, qi) => {
          if (r.status !== 'fulfilled') return;
          const ranked = filterAndRank(r.value, queries[qi], 3);
          for (const p of ranked) {
            const key = (p as { productUrl: string }).productUrl;
            if (!seen.has(key)) {
              seen.add(key);
              pool.push(p);
            }
          }
        });

        return { source: adapter.name, products: pool };
      }),
    );

    const candidates: Record<string, object[]> = {};
    settled.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.products.length > 0) {
        candidates[result.value.source] = result.value.products;
      }
    });

    return { search_queries: queries, search_query: queries[0], candidates };
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

  // Refresh prices of existing quotations by re-visiting their product URLs
  app.post<{ Params: { id: string } }>('/api/items/:id/quotations/refresh', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });
    if (!itemsDb.findById(id)) return reply.code(404).send({ error: 'Item não encontrado' });

    const quotations = quotationsDb.listByItem(id).filter((q) => !!q.product_url);

    const results = await Promise.allSettled(
      quotations.map(async (q) => {
        const newPrice = await refreshProductPrice(q.product_url!, q.source);
        if (newPrice !== null) {
          quotationsDb.refreshPrice(q.id, newPrice);
        }
        return { id: q.id, newPrice };
      }),
    );

    const updated = results.filter(
      (r) => r.status === 'fulfilled' && r.value.newPrice !== null,
    ).length;

    const errors = results
      .map((r, i) => ({ quotation_id: quotations[i].id, r }))
      .filter(({ r }) => r.status === 'rejected')
      .map(({ quotation_id, r }) => ({
        quotation_id,
        message: r.status === 'rejected' ? String(r.reason) : '',
      }));

    return { updated, total: quotations.length, errors };
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
