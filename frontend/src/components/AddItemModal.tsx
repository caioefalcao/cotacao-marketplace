import { useState } from 'react';
import { createItem, getItemCandidates, saveBulkQuotations } from '../api/items';
import type { CandidateProduct } from '../api/items';

const SOURCE_LABELS: Record<string, string> = {
  magalu: 'Magazine Luiza',
  mercadolivre: 'Mercado Livre',
  decathlon: 'Decathlon',
  netshoes: 'Netshoes',
  centauro: 'Centauro',
};

interface AddItemModalProps {
  onClose: () => void;
  onDone: (itemId: number) => void;
}

type Step = 'form' | 'loading' | 'select' | 'saving';

function formatPrice(p: number | null) {
  if (p === null) return '—';
  return p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function AddItemModal({ onClose, onDone }: AddItemModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [createdItemId, setCreatedItemId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<Record<string, CandidateProduct[]>>({});
  const [selected, setSelected] = useState<CandidateProduct[]>([]);

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setStep('loading');

    try {
      const item = await createItem({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
      });
      setCreatedItemId(item.id);

      const result = await getItemCandidates(item.id);
      setSearchQuery(result.search_query);
      setCandidates(result.candidates);
      setStep('select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar produtos');
      setStep('form');
    }
  }

  function toggleProduct(p: CandidateProduct) {
    const key = `${p.source}__${p.productUrl}`;
    setSelected((prev) => {
      const exists = prev.some((x) => `${x.source}__${x.productUrl}` === key);
      return exists
        ? prev.filter((x) => `${x.source}__${x.productUrl}` !== key)
        : [...prev, p];
    });
  }

  function isSelected(p: CandidateProduct) {
    return selected.some((x) => `${x.source}__${x.productUrl}` === `${p.source}__${p.productUrl}`);
  }

  async function handleConfirm() {
    if (!createdItemId || selected.length === 0) return;
    setStep('saving');
    try {
      await saveBulkQuotations(
        createdItemId,
        selected.map((p) => ({
          source: p.source,
          title: p.title,
          price: p.price,
          currency: p.currency,
          product_url: p.productUrl,
        })),
      );
      onDone(createdItemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cotações');
      setStep('select');
    }
  }

  const sourcesWithCandidates = Object.keys(candidates);
  const noCandidates = sourcesWithCandidates.length === 0;

  /* ── Step: form ── */
  if (step === 'form') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal__header">
            <h2>Novo Item</h2>
            <button className="modal__close" onClick={onClose}>✕</button>
          </div>

          <form onSubmit={handleFormSubmit} className="modal__form">
            {error && <div className="modal__error">{error}</div>}

            <label className="field">
              <span className="field__label">Nome do Item *</span>
              <input
                className="field__input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Anilha 20kg"
                required
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field__label">
                Descrição técnica
                <span className="field__hint"> — a IA usa para refinar a busca</span>
              </span>
              <textarea
                className="field__input field__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Anilha em disco - Finalidade: fortalecimento muscular - Peso: 20kg - Material: ferro com acabamento emborrachado"
                rows={4}
              />
            </label>

            <label className="field">
              <span className="field__label">Categoria</span>
              <input
                className="field__input"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Esporte, Informática"
              />
            </label>

            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
                Criar e Buscar Produtos →
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ── Step: loading ── */
  if (step === 'loading') {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal__loading">
            <div className="spinner" />
            <p>Buscando produtos nos marketplaces...</p>
            {description && <p className="modal__loading-hint">A IA está analisando a descrição para refinar a busca.</p>}
          </div>
        </div>
      </div>
    );
  }

  /* ── Step: saving ── */
  if (step === 'saving') {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal__loading">
            <div className="spinner" />
            <p>Salvando {selected.length} cotação{selected.length !== 1 ? 'ões' : ''}...</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step: select ── */
  return (
    <div className="modal-overlay">
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h2>Selecione os produtos para a cotação</h2>
            {searchQuery && (
              <p className="modal__subtitle">
                IA buscou: <strong>"{searchQuery}"</strong>
                {' '}· {selected.length} selecionado{selected.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {error && <div className="modal__error" style={{ margin: '0 24px' }}>{error}</div>}

        {noCandidates ? (
          <div className="modal__form">
            <div className="table-empty">
              Nenhum produto encontrado com similaridade suficiente nos marketplaces.
            </div>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => createdItemId && onDone(createdItemId)}>
                Ir para cotação vazia →
              </button>
            </div>
          </div>
        ) : (
          <div className="candidates__body">
            {sourcesWithCandidates.map((source) => (
              <div key={source} className="candidates__group">
                <div className="candidates__group-label">{SOURCE_LABELS[source] ?? source}</div>
                <div className="candidates__list">
                  {candidates[source].map((p) => {
                    const sel = isSelected(p);
                    return (
                      <label
                        key={`${p.source}__${p.productUrl}`}
                        className={`candidate-card${sel ? ' candidate-card--selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="candidate-card__check"
                          checked={sel}
                          onChange={() => toggleProduct(p)}
                        />
                        <div className="candidate-card__info">
                          <span className="candidate-card__title">{p.title}</span>
                          <span className="candidate-card__price">{formatPrice(p.price)}</span>
                        </div>
                        {p.productUrl && (
                          <a
                            href={p.productUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="candidate-card__link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver →
                          </a>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="candidates__footer">
              <button
                className="btn btn--ghost"
                onClick={() => createdItemId && onDone(createdItemId)}
              >
                Pular
              </button>
              <button
                className="btn btn--primary"
                disabled={selected.length === 0}
                onClick={handleConfirm}
              >
                Confirmar cotação ({selected.length} selecionado{selected.length !== 1 ? 's' : ''})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
