import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../../data/quotations.db');

import { mkdirSync } from 'fs';
mkdirSync(resolve(__dirname, '../../data'), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT,
    category    TEXT,
    created_at  TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS quotations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    source          TEXT NOT NULL,
    title           TEXT,
    price           REAL,
    currency        TEXT DEFAULT 'BRL',
    product_url     TEXT,
    screenshot_path TEXT,
    found_at        TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);

export interface Item {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  created_at: string;
}

export interface ItemWithStats extends Item {
  quotation_count: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  status: 'Com Cotações' | 'Sem Cotações';
}

export interface Quotation {
  id: number;
  item_id: number;
  source: string;
  title: string | null;
  price: number | null;
  currency: string;
  product_url: string | null;
  screenshot_path: string | null;
  found_at: string;
}

function calcMedian(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Nearest-rank percentile (k in 0–100)
function calcPercentile(prices: number[], k: number): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((k / 100) * sorted.length) - 1);
  return sorted[idx];
}

export const itemsDb = {
  list(): ItemWithStats[] {
    const items = db.prepare('SELECT * FROM items ORDER BY id DESC').all() as Item[];
    return items.map((item) => {
      const rows = db
        .prepare('SELECT price FROM quotations WHERE item_id = ? AND price IS NOT NULL')
        .all(item.id) as { price: number }[];
      const prices = rows.map((r) => r.price);
      return {
        ...item,
        quotation_count: prices.length,
        median: calcMedian(prices),
        p25: calcPercentile(prices, 25),
        p75: calcPercentile(prices, 75),
        status: prices.length > 0 ? 'Com Cotações' : 'Sem Cotações',
      } as ItemWithStats;
    });
  },

  create(name: string, description?: string, category?: string): Item {
    const stmt = db.prepare(
      'INSERT INTO items (name, description, category) VALUES (?, ?, ?)',
    );
    const result = stmt.run(name, description ?? null, category ?? null);
    return db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid) as Item;
  },

  findById(id: number): Item | undefined {
    return db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item | undefined;
  },

  findByIdWithStats(id: number): ItemWithStats | undefined {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item | undefined;
    if (!item) return undefined;
    const rows = db
      .prepare('SELECT price FROM quotations WHERE item_id = ? AND price IS NOT NULL')
      .all(id) as { price: number }[];
    const prices = rows.map((r) => r.price);
    return {
      ...item,
      quotation_count: prices.length,
      median: calcMedian(prices),
      p25: calcPercentile(prices, 25),
      p75: calcPercentile(prices, 75),
      status: prices.length > 0 ? 'Com Cotações' : 'Sem Cotações',
    };
  },

  update(id: number, data: { name?: string; description?: string; category?: string }): Item | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id: number): boolean {
    const result = db.prepare('DELETE FROM items WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

export const quotationsDb = {
  create(data: {
    item_id: number;
    source: string;
    title?: string;
    price?: number | null;
    currency?: string;
    product_url?: string;
    screenshot_path?: string;
  }): Quotation {
    const stmt = db.prepare(`
      INSERT INTO quotations (item_id, source, title, price, currency, product_url, screenshot_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.item_id,
      data.source,
      data.title ?? null,
      data.price ?? null,
      data.currency ?? 'BRL',
      data.product_url ?? null,
      data.screenshot_path ?? null,
    );
    return db
      .prepare('SELECT * FROM quotations WHERE id = ?')
      .get(result.lastInsertRowid) as Quotation;
  },

  listByItem(item_id: number): Quotation[] {
    return db
      .prepare('SELECT * FROM quotations WHERE item_id = ? ORDER BY found_at DESC')
      .all(item_id) as Quotation[];
  },

  deleteOne(id: number): boolean {
    const result = db.prepare('DELETE FROM quotations WHERE id = ?').run(id);
    return result.changes > 0;
  },

  update(id: number, data: { price?: number | null; product_url?: string }): Quotation | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    if ('price' in data) { fields.push('price = ?'); values.push(data.price ?? null); }
    if (data.product_url !== undefined) { fields.push('product_url = ?'); values.push(data.product_url); }
    if (fields.length === 0) return db.prepare('SELECT * FROM quotations WHERE id = ?').get(id) as Quotation | undefined;
    values.push(id);
    db.prepare(`UPDATE quotations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM quotations WHERE id = ?').get(id) as Quotation | undefined;
  },

  refreshPrice(id: number, price: number): void {
    db.prepare(
      "UPDATE quotations SET price = ?, found_at = datetime('now', 'localtime') WHERE id = ?",
    ).run(price, id);
  },
};

export default db;
