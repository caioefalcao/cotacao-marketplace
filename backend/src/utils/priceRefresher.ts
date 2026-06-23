import { getBrowser, DEFAULT_CONTEXT_OPTIONS, blockHeavyResources } from './browser.js';
import type { Page } from 'playwright';

function parsePrice(raw: string): number | null {
  const cleaned = raw
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  const v = parseFloat(cleaned);
  return isNaN(v) || v <= 0 ? null : v;
}

async function extractPrice(page: Page, source: string): Promise<number | null> {
  // Source-specific selectors first
  try {
    if (source === 'magalu') {
      const el = await page.$('[data-testid="price-value"], [data-testid="price-original"]');
      if (el) {
        const text = await el.textContent();
        const price = parsePrice(text ?? '');
        if (price) return price;
      }
    }

    if (source === 'mercadolivre') {
      const fractionEl = await page.$('.andes-money-amount__fraction');
      if (fractionEl) {
        const intPart = (await fractionEl.textContent())?.trim() ?? '';
        const centsEl = await page.$('.andes-money-amount__cents');
        const centsPart = centsEl ? ((await centsEl.textContent())?.trim() ?? '00') : '00';
        const price = parsePrice(`${intPart},${centsPart}`);
        if (price) return price;
      }
    }
  } catch {
    // fall through to generic
  }

  // Generic: scan all elements for price-like classes, then body text
  try {
    const priceSelectors = [
      '[class*="price-value"]',
      '[class*="current-price"]',
      '[class*="selling-price"]',
      '[class*="price__value"]',
      '[class*="priceBox"]',
      '[class*="productPrice"]',
    ];

    for (const sel of priceSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const text = await el.textContent();
          const price = parsePrice(text ?? '');
          if (price) return price;
        }
      } catch {
        // try next selector
      }
    }

    // Last resort: body text regex
    const bodyText = await page.evaluate(() => (document.body as HTMLElement).innerText);
    const match = bodyText.match(/R\$\s*([\d.]+),(\d{2})/);
    if (match) return parsePrice(`${match[1]},${match[2]}`);
  } catch {
    // ignore
  }

  return null;
}

export async function refreshProductPrice(
  productUrl: string,
  source: string,
): Promise<number | null> {
  const browser = await getBrowser();
  const context = await browser.newContext(DEFAULT_CONTEXT_OPTIONS);
  const page = await context.newPage();
  await blockHeavyResources(page);

  try {
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Brief wait for JS-rendered prices
    await page.waitForTimeout(1500);
    return await extractPrice(page, source);
  } catch {
    return null;
  } finally {
    await context.close();
  }
}
