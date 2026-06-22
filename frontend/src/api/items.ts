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

export interface QuoteResult {
  saved: number;
  errors: { source: string; message: string }[];
  search_query: string;
}

export async function listItems(): Promise<ItemWithStats[]> {
  const res = await fetch('/api/items');
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function createItem(data: {
  name: string;
  description?: string;
  category?: string;
}): Promise<Item> {
  const res = await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Erro ${res.status}`);
  }
  return res.json();
}

export async function deleteItem(id: number): Promise<void> {
  const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

export async function triggerQuote(id: number): Promise<QuoteResult> {
  const res = await fetch(`/api/items/${id}/quote`, { method: 'POST' });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function listQuotations(id: number): Promise<Quotation[]> {
  const res = await fetch(`/api/items/${id}/quotations`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}
