import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getBrowser, DEFAULT_CONTEXT_OPTIONS } from './browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = resolve(__dirname, '../../screenshots');

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

export async function screenshotUrl(url: string, prefix: string): Promise<string> {
  const browser = await getBrowser();
  const context = await browser.newContext(DEFAULT_CONTEXT_OPTIONS);
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    const filename = `${prefix}-${Date.now()}.png`;
    const filepath = resolve(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: false });

    return `screenshots/${filename}`;
  } finally {
    await context.close();
  }
}
