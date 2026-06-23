import { useState } from 'react';
import type { Product, SearchResponse } from '../api/search';
import { ProductCard } from './ProductCard';

const SOURCE_LABELS: Record<string, string> = {
  magalu: 'Magalu',
  mercadolivre: 'Mercado Livre',
  decathlon: 'Decathlon',
  netshoes: 'Netshoes',
  centauro: 'Centauro',
};

type SortOrder = 'relevance' | 'price-asc' | 'price-desc';

interface ResultsGridProps {
  data: SearchResponse;
}

export function ResultsGrid({ data }: ResultsGridProps) {
  const [sort, setSort] = useState<SortOrder>('relevance');
  const [activeSource, setActiveSource] = useState<string>('all');

  const sources = Array.from(new Set(data.results.map((p) => p.source)));

  const filtered: Product[] =
    activeSource === 'all'
      ? data.results
      : data.results.filter((p) => p.source === activeSource);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'relevance') {
      return (b.similarity ?? 0) - (a.similarity ?? 0);
    }
    if (sort === 'price-asc') {
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return a.price - b.price;
    }
    if (sort === 'price-desc') {
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return b.price - a.price;
    }
    return 0;
  });

  return (
    <div className="results">
      {data.search_query && (
        <div className="results__query-info">
          <span className="results__query-label">IA buscou:</span>
          <em className="results__query-text">"{data.search_query}"</em>
          <span className="results__count">{data.results.length} resultado{data.results.length !== 1 ? 's' : ''} encontrado{data.results.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="results__controls">
        <div className="results__filters">
          <button
            className={activeSource === 'all' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setActiveSource('all')}
          >
            Todos ({data.results.length})
          </button>
          {sources.map((src) => (
            <button
              key={src}
              className={activeSource === src ? 'filter-btn active' : 'filter-btn'}
              onClick={() => setActiveSource(src)}
            >
              {SOURCE_LABELS[src] ?? src} ({data.results.filter((p) => p.source === src).length})
            </button>
          ))}
        </div>

        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOrder)}
        >
          <option value="relevance">Ordenar: Relevância</option>
          <option value="price-asc">Menor preço</option>
          <option value="price-desc">Maior preço</option>
        </select>
      </div>

      {data.errors.length > 0 && (
        <div className="results__errors">
          {data.errors.map((err) => (
            <span key={err.source} className="error-chip">
              {err.source}: indisponível
            </span>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="results__empty">Nenhum resultado encontrado.</p>
      ) : (
        <div className="results__grid">
          {sorted.map((product, i) => (
            <ProductCard key={`${product.productUrl}-${i}`} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
