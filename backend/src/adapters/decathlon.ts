import { getBrowser, DEFAULT_CONTEXT_OPTIONS, blockHeavyResources } from '../utils/browser.js';
import type { Product, SourceAdapter } from './types.js';

const BASE_URL = 'https://www.decathlon.com.br';

function parsePrice(raw: string): number | null {
  // raw may be "R$ 284,99 a vistaR$ 299,99" — take first price only
  const match = raw.match(/R\$\s*([\d.,]+)/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  return isNaN(value) ? null : value;
}

export const decathlonAdapter: SourceAdapter = {
  name: 'decathlon',
  async search(query: string): Promise<Product[]> {
    const browser = await getBrowser();
    const context = await browser.newContext(DEFAULT_CONTEXT_OPTIONS);
    const page = await context.newPage();

    try {
      await blockHeavyResources(page);
      const searchUrl = `${BASE_URL}/pesquisa/?q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      await page.waitForSelector('.product-card-v2', { timeout: 10000 });

      const products = await page.evaluate((baseUrl) => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>('.product-card-v2'));
        return cards.slice(0, 20).map((card) => {
          const linkEl = card.querySelector<HTMLAnchorElement>('a[href]');
          const imgEl = card.querySelector<HTMLImageElement>('img[src]');
          const priceEl = card.querySelector<HTMLElement>('[class*="product-card__content--price"]');

          const href = linkEl?.getAttribute('href') ?? '';
          return {
            title: imgEl?.alt?.trim() ?? '',
            priceRaw: priceEl?.textContent?.trim() ?? '',
            imageUrl: imgEl?.src ?? null,
            productUrl: href.startsWith('http') ? href : `${baseUrl}${href}`,
          };
        });
      }, BASE_URL);

      return products
        .filter((p) => p.title && p.productUrl)
        .map((p) => ({
          source: 'decathlon' as const,
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
