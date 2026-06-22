import { useEffect, useState } from 'react';
import { listQuotations } from '../api/items';
import type { Quotation, ItemWithStats } from '../api/items';

const SOURCE_LABELS: Record<string, string> = {
  magalu: 'Magazine Luiza',
  mercadolivre: 'Mercado Livre',
  decathlon: 'Decathlon',
  netshoes: 'Netshoes',
  centauro: 'Centauro',
};

interface ItemDetailProps {
  item: ItemWithStats;
  onClose: () => void;
}

export function ItemDetail({ item, onClose }: ItemDetailProps) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    listQuotations(item.id)
      .then(setQuotations)
      .finally(() => setLoading(false));
  }, [item.id]);

  const prices = quotations.map((q) => q.price).filter((p): p is number => p !== null);

  function formatPrice(p: number | null) {
    if (p === null) return '—';
    return p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDate(s: string) {
    return new Date(s).toLocaleString('pt-BR');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2>{item.name}</h2>
            {item.description && <p className="modal__subtitle">{item.description}</p>}
          </div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        {prices.length > 0 && (
          <div className="detail__median-bar">
            <span className="detail__median-label">Mediana</span>
            <span className="detail__median-value">{formatPrice(item.median)}</span>
            <span className="detail__median-count">{prices.length} cotação{prices.length !== 1 ? 'ões' : ''}</span>
          </div>
        )}

        {loading ? (
          <div className="detail__loading">Carregando cotações...</div>
        ) : quotations.length === 0 ? (
          <div className="detail__empty">Nenhuma cotação encontrada. Clique em buscar na lista de itens.</div>
        ) : (
          <div className="detail__table-wrap">
            <table className="detail__table">
              <thead>
                <tr>
                  <th>Fonte</th>
                  <th>Produto</th>
                  <th>Preço</th>
                  <th>Data/Hora</th>
                  <th>Screenshot</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <span className="source-badge">{SOURCE_LABELS[q.source] ?? q.source}</span>
                    </td>
                    <td className="detail__title">{q.title ?? '—'}</td>
                    <td className="detail__price">{formatPrice(q.price)}</td>
                    <td className="detail__date">{formatDate(q.found_at)}</td>
                    <td>
                      {q.screenshot_path ? (
                        <img
                          className="detail__thumb"
                          src={`/${q.screenshot_path}`}
                          alt="screenshot"
                          onClick={() => setLightbox(`/${q.screenshot_path}`)}
                        />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {q.product_url ? (
                        <a
                          href={q.product_url}
                          target="_blank"
                          rel="noreferrer"
                          className="detail__link"
                        >
                          Ver →
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lightbox && (
        <div
          className="lightbox"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(null);
          }}
        >
          <img src={lightbox} alt="screenshot ampliado" className="lightbox__img" />
        </div>
      )}
    </div>
  );
}
