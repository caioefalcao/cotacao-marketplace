export type MarketplaceSource = 'mercadolivre' | 'amazon' | 'magalu' | 'googleshopping';

export interface Product {
  source: MarketplaceSource;
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  productUrl: string;
}

export interface SearchResponse {
  results: Product[];
  errors: { source: string; message: string }[];
}

export async function searchProducts(query: string): Promise<SearchResponse> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error(`Erro ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<SearchResponse>;
}
