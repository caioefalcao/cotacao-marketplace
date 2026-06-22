import type { Product, SourceAdapter } from './types.js';

// Centauro's CDN (Akamai) returns 403 Access Denied for all automated requests,
// regardless of user agent or headers. Throws so the error surfaces in quote results.
export const centauroAdapter: SourceAdapter = {
  name: 'centauro',
  async search(_query: string): Promise<Product[]> {
    throw new Error('Centauro bloqueou o acesso automático (Akamai 403)');
  },
};
