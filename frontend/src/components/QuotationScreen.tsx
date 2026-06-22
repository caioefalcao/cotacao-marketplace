import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getItem,
  updateItem,
  listQuotations,
  triggerQuote,
  deleteQuotation,
  updateQuotation,
} from '../api/items';
import type { ItemWithStats, Quotation } from '../api/items';

const SOURCE_LABELS: Record<string, string> = {
  magalu: 'Magazine Luiza',
  mercadolivre: 'Mercado Livre',
  decathlon: 'Decathlon',
  netshoes: 'Netshoes',
  centauro: 'Centauro',
};

const SOURCE_ICONS: Record<string, string> = {
  magalu: '🏪',
  mercadolivre: '🛒',
  decathlon: '🏃',
  netshoes: '👟',
  centauro: '🎯',
};

interface Props {
  itemId: number;
  onBack: () => void;
}

interface EditingQuotation {
  id: number;
  price: string;
  product_url: string;
}

export function QuotationScreen({ itemId, onBack }: Props) {
  const [item, setItem] = useState<ItemWithStats | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [quotingMsgIdx, setQuotingMsgIdx] = useState(0);
  const quotingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const QUOTING_MESSAGES = [
    'Consultando IA para refinar a busca...',
    'Buscando no Magazine Luiza...',
    'Buscando no Mercado Livre...',
    'Buscando na Decathlon...',
    'Buscando na Netshoes...',
    'Filtrando produtos mais relevantes...',
    'Calculando mediana e percentis...',
    'Quase lá, salvando resultados...',
  ];
  const [editing, setEditing] = useState<EditingQuotation | null>(null);
  const [editingItem, setEditingItem] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [freshItem, freshQuotations] = await Promise.all([
      getItem(itemId),
      listQuotations(itemId),
    ]);
    setItem(freshItem);
    setQuotations(freshQuotations);
  }, [itemId]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  function formatPrice(p: number | null) {
    if (p === null) return '—';
    return p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  async function handleUpdateQuote() {
    setQuotingMsgIdx(0);
    setQuoting(true);
    quotingIntervalRef.current = setInterval(() => {
      setQuotingMsgIdx((i) => (i + 1) % QUOTING_MESSAGES.length);
    }, 2200);
    try {
      await triggerQuote(itemId);
      await refresh();
    } finally {
      if (quotingIntervalRef.current) clearInterval(quotingIntervalRef.current);
      setQuoting(false);
    }
  }

  async function handleDeleteQuotation(id: number) {
    if (!confirm('Remover esta cotação?')) return;
    await deleteQuotation(id);
    await refresh();
  }

  function startEditQuotation(q: Quotation) {
    setEditing({ id: q.id, price: String(q.price ?? ''), product_url: q.product_url ?? '' });
  }

  async function saveEditQuotation() {
    if (!editing) return;
    const price = editing.price !== '' ? parseFloat(editing.price.replace(',', '.')) : null;
    await updateQuotation(editing.id, { price, product_url: editing.product_url });
    setEditing(null);
    await refresh();
  }

  function startEditItem() {
    if (!item) return;
    setEditName(item.name);
    setEditDesc(item.description ?? '');
    setEditingItem(true);
  }

  async function saveEditItem() {
    if (!item) return;
    await updateItem(item.id, { name: editName.trim(), description: editDesc.trim() });
    setEditingItem(false);
    await refresh();
  }

  // One link per source (first quotation per marketplace)
  const referenceLinks = Object.values(
    quotations.reduce<Record<string, Quotation>>((acc, q) => {
      if (!acc[q.source] && q.product_url) acc[q.source] = q;
      return acc;
    }, {}),
  );

  if (loading) {
    return <div className="view"><div className="table-empty">Carregando...</div></div>;
  }

  if (!item) {
    return <div className="view"><div className="table-empty">Item não encontrado.</div></div>;
  }

  return (
    <div className="view qs">
      {/* ── Header ── */}
      <div className="qs__header">
        <div className="qs__header-left">
          <div className="qs__title-row">
            <h1 className="qs__name">{item.name}</h1>
            <span className="qs__id-badge">ID: {item.id}</span>
          </div>

          {item.description && (
            <div className="qs__desc-box">
              <span className="qs__desc-label">DESCRIÇÃO:</span>
              <p className="qs__desc-text">{item.description}</p>
            </div>
          )}

          <div className="qs__header-actions">
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => {
                navigator.clipboard.writeText(item.name);
              }}
            >
              📋 Copiar Nome
            </button>
            <button className="btn btn--ghost btn--sm" onClick={startEditItem}>
              ✏️ Editar Item
            </button>
          </div>
        </div>

        <div className="qs__stats">
          <div className="qs__stat">
            <span className="qs__stat-label">Mediana das Cotações</span>
            <span className="qs__stat-value qs__stat-value--primary">{formatPrice(item.median)}</span>
          </div>
          {item.quotation_count >= 2 && (
            <>
              <div className="qs__stat">
                <span className="qs__stat-label">P25 — menor faixa</span>
                <span className="qs__stat-value qs__stat-value--success">{formatPrice(item.p25)}</span>
              </div>
              <div className="qs__stat">
                <span className="qs__stat-label">P75 — maior faixa</span>
                <span className="qs__stat-value qs__stat-value--danger">{formatPrice(item.p75)}</span>
              </div>
            </>
          )}
          <button className="btn btn--ghost btn--sm" onClick={onBack}>← Voltar</button>
        </div>
      </div>

      {/* ── Links de Referência ── */}
      {referenceLinks.length > 0 && (
        <div className="card card--padded qs__ref-card">
          <h3 className="qs__section-title">Links de Referência</h3>
          <div className="qs__ref-links">
            {referenceLinks.map((q) => (
              <a
                key={q.source}
                href={q.product_url ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="qs__ref-link"
              >
                <span>{SOURCE_ICONS[q.source] ?? '🔗'}</span>
                {SOURCE_LABELS[q.source] ?? q.source}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Atualizar Cotação ── */}
      <div className="qs__quote-action">
        <button
          className="btn btn--primary btn--lg"
          onClick={handleUpdateQuote}
          disabled={quoting}
        >
          🔄 Atualizar Cotação
        </button>
      </div>

      {/* ── Loading overlay (durante busca) ── */}
      {quoting && (
        <div className="quoting-overlay">
          <div className="quoting-overlay__box">
            <div className="spinner spinner--lg" />
            <p className="quoting-overlay__msg">{QUOTING_MESSAGES[quotingMsgIdx]}</p>
            <p className="quoting-overlay__hint">
              Buscando nos marketplaces e filtrando os resultados mais relevantes.<br />
              Isso pode levar até 30 segundos.
            </p>
          </div>
        </div>
      )}

      {/* ── Cotações Cadastradas ── */}
      <div className="card">
        <div className="qs__table-header">
          <h3 className="qs__section-title">Cotações Cadastradas</h3>
          {item.quotation_count > 0 && (
            <span className="qs__count">{item.quotation_count} cotação{item.quotation_count !== 1 ? 'ões' : ''}</span>
          )}
        </div>

        {quotations.length === 0 ? (
          <div className="table-empty">
            Nenhuma cotação ainda. Clique em "Atualizar Cotação" para buscar automaticamente.
          </div>
        ) : (
          <table className="items-table qs__table">
            <thead>
              <tr>
                <th>Link do Produto</th>
                <th style={{ width: 160 }}>Valor Unitário</th>
                <th style={{ width: 120 }}>Imagem</th>
                <th style={{ width: 100 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) =>
                editing?.id === q.id ? (
                  <tr key={q.id} className="qs__editing-row">
                    <td>
                      <input
                        className="field__input"
                        value={editing.product_url}
                        onChange={(e) => setEditing({ ...editing, product_url: e.target.value })}
                        placeholder="URL do produto"
                      />
                    </td>
                    <td>
                      <input
                        className="field__input"
                        value={editing.price}
                        onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                        placeholder="Preço"
                        style={{ width: 120 }}
                      />
                    </td>
                    <td />
                    <td>
                      <div className="action-btns">
                        <button className="btn btn--primary btn--sm" onClick={saveEditQuotation}>Salvar</button>
                        <button className="btn btn--ghost btn--sm" onClick={() => setEditing(null)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={q.id}>
                    <td>
                      {q.title && (
                        <div className="qs__product-title">{q.title}</div>
                      )}
                      <a
                        href={q.product_url ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="qs__product-url"
                        title={q.product_url ?? ''}
                      >
                        {(q.product_url ?? '').length > 55
                          ? (q.product_url ?? '').slice(0, 55) + '...'
                          : (q.product_url ?? '—')}
                      </a>
                      <div className="qs__source-name">{SOURCE_LABELS[q.source] ?? q.source}</div>
                    </td>
                    <td className="qs__price">{formatPrice(q.price)}</td>
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
                      <div className="action-btns">
                        <button
                          className="action-btn action-btn--view"
                          title="Editar"
                          onClick={() => startEditQuotation(q)}
                        >
                          ✏️
                        </button>
                        <button
                          className="action-btn action-btn--delete"
                          title="Remover"
                          onClick={() => handleDeleteQuotation(q.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit Item Modal ── */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>Editar Item</h2>
              <button className="modal__close" onClick={() => setEditingItem(false)}>✕</button>
            </div>
            <div className="modal__form">
              <label className="field">
                <span className="field__label">Nome *</span>
                <input
                  className="field__input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Descrição técnica</span>
                <textarea
                  className="field__input field__textarea"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                />
              </label>
              <div className="modal__actions">
                <button className="btn btn--ghost" onClick={() => setEditingItem(false)}>Cancelar</button>
                <button
                  className="btn btn--primary"
                  disabled={!editName.trim()}
                  onClick={saveEditItem}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="screenshot ampliado" className="lightbox__img" />
        </div>
      )}
    </div>
  );
}
