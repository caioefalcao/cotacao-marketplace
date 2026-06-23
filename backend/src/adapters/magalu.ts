import { getBrowser, DEFAULT_CONTEXT_OPTIONS, blockHeavyResources } from '../utils/browser.js';
import type { Product, SourceAdapter } from './types.js';

const BASE_URL = 'https://www.magazinevoce.com.br';

function parsePrice(raw: string): number | null {
  const cleaned = raw
    .replace(/ou\s+/i, '')
    .replace('R$', '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

export const magaluAdapter: SourceAdapter = {
  name: 'magalu',
  async search(query: string): Promise<Product[]> {
    const browser = await getBrowser();
    const context = await browser.newContext(DEFAULT_CONTEXT_OPTIONS);
    const page = await context.newPage();

    try {
      await blockHeavyResources(page);
      const searchUrl = `${BASE_URL}/magazinevoce/busca/${encodeURIComponent(query)}/`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

      await page.waitForSelector('[data-testid="product-card-container"]', { timeout: 20000 });

      const products = await page.evaluate((baseUrl) => {
        const cards = Array.from(
          document.querySelectorAll<HTMLElement>('[data-testid="product-card-container"]'),
        );

        return cards.slice(0, 20).map((card) => {
          const titleEl = card.querySelector<HTMLElement>('[data-testid="product-title"]');
          const priceOriginalEl = card.querySelector<HTMLElement>('[data-testid="price-original"]');
          const priceValueEl = card.querySelector<HTMLElement>('[data-testid="price-value"]');
          const imgEl = card.querySelector<HTMLImageElement>('[data-testid="image"]');
          const href = card.getAttribute('href') || card.querySelector('a')?.getAttribute('href') || '';

          return {
            title: titleEl?.textContent?.trim() ?? '',
            priceRaw: priceOriginalEl?.textContent?.trim() ?? priceValueEl?.textContent?.trim() ?? '',
            imageUrl: imgEl?.src ?? imgEl?.getAttribute('data-src') ?? null,
            productUrl: href.startsWith('http') ? href : `${baseUrl}${href}`,
          };
        });
      }, BASE_URL);

      return products
        .filter((p) => p.title && p.productUrl)
        .map((p) => ({
          source: 'magalu' as const,
          title: p.title,
          price: parsePrice(p.priceRaw),
          currency: 'BRL',
          imageUrl: p.imageUrl,
          productUrl: p.productUrl,
        }));
    } finally {
      await context.close();
    }
  },
};
