import { getBrowser, DEFAULT_CONTEXT_OPTIONS, blockHeavyResources } from '../utils/browser.js';
import type { Product, SourceAdapter } from './types.js';

const BASE_URL = 'https://www.netshoes.com.br';

function parsePrice(raw: string): number | null {
  // raw may be "R$ 249,99\nR$ 94,99\nno Pix" — take first price
  const match = raw.match(/R\$\s*([\d.,]+)/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  return isNaN(value) ? null : value;
}

export const netshoesAdapter: SourceAdapter = {
  name: 'netshoes',
  async search(query: string): Promise<Product[]> {
    const browser = await getBrowser();
    const context = await browser.newContext(DEFAULT_CONTEXT_OPTIONS);
    const page = await context.newPage();

    try {
      await blockHeavyResources(page);
      const searchUrl = `${BASE_URL}/busca?nsCat=natural&q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

      // Wait for JS to render product cards (up to 12s)
      try {
        await page.waitForSelector('.card.double-columns', { timeout: 12000 });
      } catch {
        // Page may be a category landing or have no results — return empty gracefully
        return [];
      }

      const products = await page.evaluate((baseUrl) => {
        const cards = Array.from(
          document.querySelectorAll<HTMLElement>('.card.double-columns'),
        );

        return cards.slice(0, 20).map((card) => {
          const linkEl = card.querySelector<HTMLAnchorElement>('a.card__link');
          const imgEl = card.querySelector<HTMLImageElement>('img.image');
          const nameEl = card.querySelector<HTMLElement>('.card__description--name');
          const priceEl = card.querySelector<HTMLElement>('[class*="price__list"]');

          const href = linkEl?.getAttribute('href') ?? '';
          return {
            title: nameEl?.textContent?.trim() ?? imgEl?.alt?.trim() ?? '',
            priceRaw: priceEl?.textContent?.trim() ?? '',
            imageUrl: imgEl?.src ?? null,
            productUrl: href.startsWith('http') ? href : `${baseUrl}${href}`,
          };
        });
      }, BASE_URL);

      return products
        .filter((p) => p.title && p.productUrl)
        .map((p) => ({
          source: 'netshoes' as const,
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
