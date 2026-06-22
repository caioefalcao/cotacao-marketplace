import type { FastifyInstance } from 'fastify';
import type { Product, SourceAdapter } from '../adapters/types.js';
import { TtlCache } from '../utils/cache.js';

const ADAPTER_TIMEOUT_MS = 25000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface SearchResponse {
  results: Product[];
  errors: { source: string; message: string }[];
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function registerSearchRoute(app: FastifyInstance, adapters: SourceAdapter[]) {
  const cache = new TtlCache<SearchResponse>(CACHE_TTL_MS);

  app.get<{ Querystring: { q?: string } }>('/api/search', async (request, reply) => {
    const query = request.query.q?.trim();
    if (!query) {
      return reply.status(400).send({ error: 'Missing required query parameter "q"' });
    }

    const cached = cache.get(query);
    if (cached) {
      return cached;
    }

    const settled = await Promise.allSettled(
      adapters.map((adapter) => withTimeout(adapter.search(query), ADAPTER_TIMEOUT_MS, adapter.name)),
    );

    const response: SearchResponse = { results: [], errors: [] };

    settled.forEach((result, index) => {
      const source = adapters[index].name;
      if (result.status === 'fulfilled') {
        response.results.push(...result.value);
      } else {
        response.errors.push({ source, message: result.reason?.message ?? 'Unknown error' });
      }
    });

    cache.set(query, response);
    return response;
  });
}
