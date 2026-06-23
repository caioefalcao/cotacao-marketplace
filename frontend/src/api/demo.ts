import type { CandidateProduct } from './items';

type DemoSource = 'mercadolivre' | 'magalu' | 'netshoes';

// ── Mercado Livre public API ───────────────────────────────────────
async function fetchML(query: string): Promise<CandidateProduct[]> {
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
      currency: 'BRL',
      imageUrl: item.thumbnail
        ? String(item.thumbnail).replace('http://', 'https://')
        : null,
      productUrl: String(item.permalink ?? ''),
    }));
  } catch {
    return [];
  }
}

// ── Mock generator (deterministic, baseado nos preços reais do ML) ─
const STORE_META: Record<DemoSource, { label: string; urlBase: string; suffix: string[] }> = {
  mercadolivre: { label: 'Mercado Livre', urlBase: 'mercadolivre.com.br', suffix: [] },
  magalu: {
    label: 'Magazine Luiza',
    urlBase: 'magazinevoce.com.br',
    suffix: ['- Magazine Luiza', '| Magalu', '- Loja Oficial'],
  },
  netshoes: {
    label: 'Netshoes',
    urlBase: 'netshoes.com.br',
    suffix: ['- Netshoes', '| Netshoes Brasil', '- Frete Grátis'],
  },
};

// Hash determinístico para variações de preço reproduzíveis
function deterministicVariation(seed: string, index: number): number {
  let h = index * 31;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  // Retorna valor entre -0.12 e +0.12
  return ((Math.abs(h) % 25) - 12) / 100;
}

function mockFromML(
  source: DemoSource,
  query: string,
  mlResults: CandidateProduct[],
): CandidateProduct[] {
  const meta = STORE_META[source];
  const base = mlResults.slice(0, 4);
  if (base.length === 0) return [];

  return base.map((ref, i) => {
    const variation = deterministicVariation(`${source}${query}${i}`, i);
    const rawPrice = ref.price !== null ? ref.price * (1 + variation) : null;
    const price = rawPrice !== null ? Math.round(rawPrice * 100) / 100 : null;
    const suffix = meta.suffix[i % meta.suffix.length] ?? '';
    return {
      source: source as CandidateProduct['source'],
      title: suffix ? `${ref.title} ${suffix}` : ref.title,
      price,
      currency: 'BRL',
      imageUrl: null,
      productUrl: `https://www.${meta.urlBase}/busca?q=${encodeURIComponent(query)}`,
    };
  });
}

// ── API pública ────────────────────────────────────────────────────
export async function searchAllDemo(
  query: string,
): Promise<Record<string, CandidateProduct[]>> {
  const mlResults = await fetchML(query);

  const candidates: Record<string, CandidateProduct[]> = {};

  if (mlResults.length > 0) {
    candidates['mercadolivre'] = mlResults.slice(0, 4);
    candidates['magalu'] = mockFromML('magalu', query, mlResults);
    candidates['netshoes'] = mockFromML('netshoes', query, mlResults);
  }

  return candidates;
}

// ── Estatísticas ───────────────────────────────────────────────────
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
