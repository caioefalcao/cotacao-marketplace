import type { Product } from '../api/search';

const SOURCE_LABELS: Record<string, string> = {
  magalu: 'Magazine Luiza',
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
  googleshopping: 'Google Shopping',
  decathlon: 'Decathlon',
  netshoes: 'Netshoes',
  centauro: 'Centauro',
};

const SOURCE_COLORS: Record<string, string> = {
  magalu: '#0086c8',
  mercadolivre: '#ffe600',
  amazon: '#ff9900',
  googleshopping: '#4285f4',
  decathlon: '#007dbc',
  netshoes: '#e60000',
  centauro: '#f58220',
};

function SimilarityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let color: string;
  let label: string;
  if (pct >= 80) {
    color = '#28a745';
    label = 'Alta';
  } else if (pct >= 50) {
    color = '#e0a800';
    label = 'Média';
  } else {
    color = '#6c757d';
    label = 'Baixa';
  }
  return (
    <div className="product-card__similarity" style={{ borderColor: color }}>
      <span className="product-card__sim-pct" style={{ color }}>{pct}%</span>
      <span className="product-card__sim-label" style={{ color }}>{label} relevância</span>
    </div>
  );
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const label = SOURCE_LABELS[product.source] ?? product.source;
  const color = SOURCE_COLORS[product.source] ?? '#888';

  const formattedPrice =
    product.price !== null
      ? product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'Preço indisponível';

  return (
    <a
      className="product-card"
      href={product.productUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="product-card__badge" style={{ backgroundColor: color }}>
        {label}
      </div>
      <div className="product-card__image-wrapper">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.title} loading="lazy" />
        ) : (
          <div className="product-card__no-image">Sem imagem</div>
        )}
      </div>
      <div className="product-card__body">
        <p className="product-card__title">{product.title}</p>
        <p className="product-card__price">{formattedPrice}</p>
        {product.similarity !== undefined && (
          <SimilarityBadge score={product.similarity} />
        )}
        <span className="product-card__cta">Ver produto →</span>
      </div>
    </a>
  );
}
