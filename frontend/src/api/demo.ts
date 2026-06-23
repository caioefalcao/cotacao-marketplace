import type { CandidateProduct } from './items';

export async function searchMLDemo(query: string): Promise<CandidateProduct[]> {
  try {
    const res = await fetch(
      `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=12`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((item: Record<string, unknown>) => ({
      source: 'mercadolivre' as const,
      title: String(item.title ?? ''),
      price: typeof item.price === 'number' ? item.price : null,
      currency: String(item.currency_id ?? 'BRL'),
      imageUrl: item.thumbnail
        ? String(item.thumbnail).replace('http://', 'https://')
        : null,
      productUrl: String(item.permalink ?? ''),
    }));
  } catch {
    return [];
  }
}

export function calcStats(prices: number[]): {
  median: number | null;
  p25: number | null;
  p75: number | null;
} {
  if (prices.length === 0) return { median: null, p25: null, p75: null };
  const s = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  const p25 = s[Math.ceil(0.25 * s.length) - 1] ?? null;
  const p75 = s[Math.ceil(0.75 * s.length) - 1] ?? null;
  return { median, p25, p75 };
}
