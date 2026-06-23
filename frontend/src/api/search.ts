export type MarketplaceSource = 'mercadolivre' | 'amazon' | 'magalu' | 'googleshopping';

export interface Product {
  source: MarketplaceSource;
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  productUrl: string;
  similarity?: number;
}

export interface SearchResponse {
  results: Product[];
  errors: { source: string; message: string }[];
  search_query: string;
}

export async function searchProducts(
  name: string,
  description?: string,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: name });
  if (description?.trim()) params.set('description', description.trim());

  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) {
    throw new Error(`Erro ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<SearchResponse>;
}
