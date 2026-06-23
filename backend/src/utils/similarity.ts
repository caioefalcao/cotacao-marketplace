import type { Product } from '../adapters/types.js';

const STOP_WORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'com', 'para', 'e', 'a', 'o', 'em',
  'um', 'uma', 'no', 'na', 'por', 'que', 'se', 'ao', 'os', 'as', 'ou',
  'ate', 'mais', 'menos', 'tipo', 'modelo', 'the', 'and', 'for',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreSimilarity(query: string, title: string): number {
  const queryWords = normalize(query)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (queryWords.length === 0) return 1;

  const normalizedTitle = normalize(title);
  const matches = queryWords.filter((w) => normalizedTitle.includes(w)).length;
  return matches / queryWords.length;
}

/**
 * Filters products by minimum similarity to the query, sorts by relevance
 * and returns the top N per call (already scoped to one marketplace source).
 */
export function filterAndRank(
  products: Product[],
  query: string,
  topN: number,
  minSimilarity = 0.7,
): Product[] {
  return products
    .map((p) => ({ product: p, score: scoreSimilarity(query, p.title) }))
    .filter(({ score }) => score >= minSimilarity)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ product }) => product);
}

/**
 * Returns ALL products sorted by similarity (descending), with the similarity
 * score attached. No minimum threshold — intended for display in search views.
 */
export function rankAll(products: Product[], query: string): Product[] {
  return products
    .map((p) => ({ ...p, similarity: scoreSimilarity(query, p.title) }))
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
}
