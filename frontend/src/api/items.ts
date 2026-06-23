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

export interface CandidateProduct {
  source: string;
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  productUrl: string;
}

export interface CandidatesResponse {
  search_query: string;
  search_queries: string[];
  candidates: Record<string, CandidateProduct[]>;
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

export async function getItem(id: number): Promise<ItemWithStats> {
  const res = await fetch(`/api/items/${id}`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function updateItem(
  id: number,
  data: { name?: string; description?: string; category?: string },
): Promise<Item> {
  const res = await fetch(`/api/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function listQuotations(id: number): Promise<Quotation[]> {
  const res = await fetch(`/api/items/${id}/quotations`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function deleteQuotation(id: number): Promise<void> {
  const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}

export async function getItemCandidates(id: number): Promise<CandidatesResponse> {
  const res = await fetch(`/api/items/${id}/candidates`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function saveBulkQuotations(
  itemId: number,
  products: Array<{
    source: string;
    title: string;
    price: number | null;
    currency: string;
    product_url: string;
  }>,
): Promise<{ saved: number }> {
  const res = await fetch(`/api/items/${itemId}/quotations/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products }),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function updateQuotation(
  id: number,
  data: { price?: number | null; product_url?: string },
): Promise<Quotation> {
  const res = await fetch(`/api/quotations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function refreshQuotations(
  itemId: number,
): Promise<{ updated: number; total: number; errors: { quotation_id: number; message: string }[] }> {
  const res = await fetch(`/api/items/${itemId}/quotations/refresh`, { method: 'POST' });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}
