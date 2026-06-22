export type MarketplaceSource =
  | 'mercadolivre'
  | 'amazon'
  | 'magalu'
  | 'googleshopping'
  | 'decathlon'
  | 'centauro'
  | 'netshoes';

export interface Product {
  source: MarketplaceSource;
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  productUrl: string;
  screenshotPath?: string;
}

export interface SourceAdapter {
  name: MarketplaceSource;
  search(query: string): Promise<Product[]>;
}
