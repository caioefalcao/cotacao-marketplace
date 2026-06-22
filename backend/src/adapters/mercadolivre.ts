import { getBrowser, DEFAULT_CONTEXT_OPTIONS, blockHeavyResources } from '../utils/browser.js';
import type { Product, SourceAdapter } from './types.js';

const BASE_URL = 'https://www.mercadolivre.com.br';

function parsePrice(raw: string): number | null {
  // "R$ 1.299,99" or "1.299" (cents in separate el) → normalize
  const cleaned = raw
    .replace(/R\$\s*/g, '')
    .replace(/ /g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

export const mercadoLivreAdapter: SourceAdapter = {
  name: 'mercadolivre',
  async search(query: string): Promise<Product[]> {
    const browser = await getBrowser();
    const context = await browser.newContext(DEFAULT_CONTEXT_OPTIONS);
    const page = await context.newPage();

    try {
      await blockHeavyResources(page);
      const searchUrl = `${BASE_URL}/jm/search?as_word=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

      // Wait for search result cards
      try {
        await page.waitForSelector('.ui-search-layout__item', { timeout: 12000 });
      } catch {
        return [];
      }

      const products = await page.evaluate((baseUrl) => {
        const cards = Array.from(
          document.querySelectorAll<HTMLElement>('.ui-search-layout__item'),
        );

        return cards.slice(0, 20).map((card) => {
          // Title
          const titleEl =
            card.querySelector<HTMLElement>('.poly-component__title') ??
            card.querySelector<HTMLElement>('.ui-search-item__title');

          // Price — ML splits integer and cents into separate elements
          const integerEl = card.querySelector<HTMLElement>('.andes-money-amount__fraction');
          const centsEl = card.querySelector<HTMLElement>('.andes-money-amount__cents');
          let priceRaw = '';
          if (integerEl) {
            priceRaw = integerEl.textContent?.trim() ?? '';
            if (centsEl) priceRaw += ',' + (centsEl.textContent?.trim() ?? '00');
          } else {
            // Fallback: grab any money amount text
            const amountEl = card.querySelector<HTMLElement>('.andes-money-amount');
            priceRaw = amountEl?.textContent?.trim() ?? '';
          }

          // Image
          const imgEl =
            card.querySelector<HTMLImageElement>('.poly-component__picture img') ??
            card.querySelector<HTMLImageElement>('img.ui-search-result-image__element') ??
            card.querySelector<HTMLImageElement>('img');

          // Link
          const linkEl =
            card.querySelector<HTMLAnchorElement>('a.poly-card__portada') ??
            card.querySelector<HTMLAnchorElement>('.ui-search-item__group__element') ??
            card.querySelector<HTMLAnchorElement>('a');
          const href = linkEl?.href ?? '';

          return {
            title: titleEl?.textContent?.trim() ?? '',
            priceRaw,
            imageUrl: imgEl?.src ?? imgEl?.getAttribute('data-src') ?? null,
            productUrl: href.startsWith('http') ? href : `${baseUrl}${href}`,
          };
        });
      }, BASE_URL);

      return products
        .filter((p) => p.title && p.productUrl)
        .map((p) => ({
          source: 'mercadolivre' as const,
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
