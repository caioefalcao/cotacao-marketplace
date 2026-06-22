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

export const itemsDb = {
  list(): ItemWithStats[] {
    const items = db.prepare('SELECT * FROM items ORDER BY id DESC').all() as Item[];
    return items.map((item) => {
      const rows = db
        .prepare('SELECT price FROM quotations WHERE item_id = ? AND price IS NOT NULL')
        .all(item.id) as { price: number }[];
      const prices = rows.map((r) => r.price);
      const median = calcMedian(prices);
      return {
        ...item,
        quotation_count: prices.length,
        median,
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
};

export default db;
