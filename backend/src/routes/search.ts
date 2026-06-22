import type { FastifyInstance } from 'fastify';
import type { Product, SourceAdapter } from '../adapters/types.js';
import { TtlCache } from '../utils/cache.js';
import { refineSearchQuery } from '../utils/queryRefiner.js';
import { filterAndRank } from '../utils/similarity.js';

const ADAPTER_TIMEOUT_MS = 25000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface SearchResponse {
  results: Product[];
  errors: { source: string; message: string }[];
  search_query: string;
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

  app.get<{ Querystring: { q?: string; description?: string } }>(
    '/api/search',
    async (request, reply) => {
      const name = request.query.q?.trim();
      const description = request.query.description?.trim();

      if (!name) {
        return reply.status(400).send({ error: 'Missing required query parameter "q"' });
      }

      // Only refine when description is provided
      const searchQuery = description ? await refineSearchQuery(name, description) : name;

      const cacheKey = `${name}||${description ?? ''}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const settled = await Promise.allSettled(
        adapters.map((adapter) =>
          withTimeout(adapter.search(searchQuery), ADAPTER_TIMEOUT_MS, adapter.name),
        ),
      );

      const response: SearchResponse = { results: [], errors: [], search_query: searchQuery };

      settled.forEach((result, index) => {
        const source = adapters[index].name;
        if (result.status === 'fulfilled') {
          const top2 = filterAndRank(result.value, searchQuery, 2);
          response.results.push(...top2);
        } else {
          response.errors.push({ source, message: result.reason?.message ?? 'Unknown error' });
        }
      });

      cache.set(cacheKey, response);
      return response;
    },
  );
}
