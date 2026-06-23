import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { searchMLDemo, calcStats } from './api/demo';
import type { CandidateProduct } from './api/items';
import './App.css';

// ── Types ──────────────────────────────────────────────────────────
interface DemoItem {
  id: number;
  name: string;
  description: string;
  category: string;
}

interface DemoQuotation {
  id: number;
  source: string;
  title: string;
  price: number | null;
  currency: string;
  productUrl: string;
  imageUrl: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────
let nextId = 1;
function uid() { return nextId++; }

function fmt(p: number | null) {
  if (p === null) return '—';
  return p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── AddItemModal (demo) ────────────────────────────────────────────
type Step = 'form' | 'loading' | 'select' | 'done';

interface AddModalProps {
  onClose(): void;
  onDone(item: DemoItem, quotations: DemoQuotation[]): void;
}

function DemoAddModal({ onClose, onDone }: AddModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [candidates, setCandidates] = useState<CandidateProduct[]>([]);
  const [selected, setSelected] = useState<CandidateProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setStep('loading');
    setError(null);
    const results = await searchMLDemo(name.trim());
    if (results.length === 0) {
      setError('Nenhum produto encontrado no Mercado Livre para este item.');
      setStep('form');
      return;
    }
    setCandidates(results);
    setStep('select');
  }

  function toggle(p: CandidateProduct) {
    const key = p.productUrl;
    setSelected(prev =>
      prev.some(x => x.productUrl === key)
        ? prev.filter(x => x.productUrl !== key)
        : [...prev, p],
    );
  }

  function handleConfirm() {
    const item: DemoItem = { id: uid(), name: name.trim(), description: description.trim(), category: category.trim() };
    const quotations: DemoQuotation[] = selected.map(p => ({
      id: uid(),
      source: p.source,
      title: p.title,
      price: p.price,
      currency: p.currency,
      productUrl: p.productUrl,
      imageUrl: p.imageUrl,
    }));
    onDone(item, quotations);
  }

  if (step === 'form') return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2>Novo Item <span style={{ fontSize: 12, color: '#aaa', fontWeight: 400 }}>(modo demo)</span></h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal__form">
          {error && <div className="modal__error">{error}</div>}
          <label className="field">
            <span className="field__label">Nome do Item *</span>
            <input className="field__input" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Bola de futebol" required autoFocus />
          </label>
          <label className="field">
            <span className="field__label">Descrição técnica</span>
            <textarea className="field__input field__textarea" value={description}
              onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Ex: Bola de futebol campo, tamanho 5, material sintético" />
          </label>
          <label className="field">
            <span className="field__label">Categoria</span>
            <input className="field__input" value={category} onChange={e => setCategory(e.target.value)}
              placeholder="Ex: Esporte" />
          </label>
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
              Buscar no Mercado Livre →
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (step === 'loading') return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__loading">
          <div className="spinner" />
          <p>Buscando produtos no Mercado Livre...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div style={{ flex: 1 }}>
            <h2>Selecione os produtos para a cotação</h2>
            <p className="modal__subtitle">
              <strong>{name}</strong> · Mercado Livre · {selected.length} selecionado{selected.length !== 1 ? 's' : ''}
            </p>
            {description && (
              <div className="candidates__item-desc">
                <span className="candidates__item-desc-label">Descrição:</span> {description}
              </div>
            )}
          </div>
        </div>

        <div className="candidates__body">
          <div className="candidates__group">
            <div className="candidates__group-label">Mercado Livre</div>
            <div className="candidates__list">
              {candidates.map(p => {
                const sel = selected.some(x => x.productUrl === p.productUrl);
                return (
                  <label key={p.productUrl} className={`candidate-card${sel ? ' candidate-card--selected' : ''}`}>
                    <input type="checkbox" className="candidate-card__check" checked={sel} onChange={() => toggle(p)} />
                    <div className="candidate-card__thumb-wrap">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.title} className="candidate-card__thumb"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex'); }} />
                        : null}
                      <div className="candidate-card__no-img" style={{ display: p.imageUrl ? 'none' : 'flex' }}>🖼</div>
                    </div>
                    <div className="candidate-card__info">
                      <span className="candidate-card__title">{p.title}</span>
                      <span className="candidate-card__price">{fmt(p.price)}</span>
                    </div>
                    {p.productUrl && (
                      <a href={p.productUrl} target="_blank" rel="noreferrer" className="candidate-card__link"
                        onClick={e => e.stopPropagation()}>Ver →</a>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="candidates__footer">
            <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn--primary" disabled={selected.length === 0} onClick={handleConfirm}>
              Confirmar cotação ({selected.length} selecionado{selected.length !== 1 ? 's' : ''})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── QuotationScreen (demo) ─────────────────────────────────────────
interface QuotationProps {
  item: DemoItem;
  quotations: DemoQuotation[];
  onBack(): void;
}

function DemoQuotationScreen({ item, quotations, onBack }: QuotationProps) {
  const prices = quotations.map(q => q.price).filter((p): p is number => p !== null);
  const { median, p25, p75 } = calcStats(prices);

  return (
    <div className="view qs">
      <div className="qs__header">
        <div className="qs__header-left">
          <div className="qs__title-row">
            <h1 className="qs__name">{item.name}</h1>
            <span className="qs__id-badge">DEMO</span>
          </div>
          {item.description && (
            <div className="qs__desc-box">
              <span className="qs__desc-label">DESCRIÇÃO:</span>
              <p className="qs__desc-text">{item.description}</p>
            </div>
          )}
        </div>
        <div className="qs__stats">
          <div className="qs__stat">
            <span className="qs__stat-label">Mediana das Cotações</span>
            <span className="qs__stat-value qs__stat-value--primary">{fmt(median)}</span>
          </div>
          {prices.length >= 2 && (
            <>
              <div className="qs__stat">
                <span className="qs__stat-label">P25 — menor faixa</span>
                <span className="qs__stat-value qs__stat-value--success">{fmt(p25)}</span>
              </div>
              <div className="qs__stat">
                <span className="qs__stat-label">P75 — maior faixa</span>
                <span className="qs__stat-value qs__stat-value--danger">{fmt(p75)}</span>
              </div>
            </>
          )}
          <button className="btn btn--ghost btn--sm" onClick={onBack}>← Voltar</button>
        </div>
      </div>

      <div className="card">
        <div className="qs__table-header">
          <h3 className="qs__section-title">Cotações Cadastradas</h3>
          <span className="qs__count">{quotations.length} cotação{quotations.length !== 1 ? 'ões' : ''}</span>
        </div>
        <table className="items-table qs__table">
          <thead>
            <tr>
              <th>Produto</th>
              <th style={{ width: 160 }}>Valor Unitário</th>
              <th style={{ width: 120 }}>Imagem</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map(q => (
              <tr key={q.id}>
                <td>
                  {q.title && <div className="qs__product-title">{q.title}</div>}
                  <a href={q.productUrl} target="_blank" rel="noreferrer" className="qs__product-url">
                    {q.productUrl.length > 55 ? q.productUrl.slice(0, 55) + '...' : q.productUrl}
                  </a>
                  <div className="qs__source-name">Mercado Livre</div>
                </td>
                <td className="qs__price">{fmt(q.price)}</td>
                <td>
                  {q.imageUrl
                    ? <img className="detail__thumb" src={q.imageUrl} alt={q.title} />
                    : <span className="text-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Item List (demo) ───────────────────────────────────────────────
interface ItemListProps {
  items: DemoItem[];
  quotationMap: Record<number, DemoQuotation[]>;
  onAddItem(): void;
  onViewDetail(id: number): void;
}

function DemoItemList({ items, quotationMap, onAddItem, onViewDetail }: ItemListProps) {
  return (
    <div className="view">
      <div className="view__header">
        <div>
          <h1 className="view__title">Lista de Materiais</h1>
          <p className="view__subtitle">Modo demo — dados não são salvos entre sessões</p>
        </div>
        <button className="btn btn--primary" onClick={onAddItem}>+ Novo Item</button>
      </div>
      <div className="card">
        {items.length === 0 ? (
          <div className="table-empty">Nenhum item cadastrado. Clique em "+ Novo Item" para começar.</div>
        ) : (
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Nome do Item</th>
                <th>Categoria</th>
                <th>Mediana</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const qs = quotationMap[item.id] ?? [];
                const prices = qs.map(q => q.price).filter((p): p is number => p !== null);
                const { median } = calcStats(prices);
                const hasCot = qs.length > 0;
                return (
                  <tr key={item.id}>
                    <td className="text-muted">#{item.id}</td>
                    <td>
                      <div className="item-name">{item.name}</div>
                      {item.description && <div className="item-desc">{item.description}</div>}
                    </td>
                    <td className="text-muted">{item.category || '—'}</td>
                    <td className="price-cell">
                      <span className="price-value">{fmt(median)}</span>
                      {hasCot && <span className="price-count">{qs.length} cot.</span>}
                    </td>
                    <td>
                      <span className={`status-badge ${hasCot ? 'status-badge--success' : 'status-badge--muted'}`}>
                        {hasCot ? 'Com Cotações' : 'Sem Cotações'}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="action-btn action-btn--view" title="Ver cotações"
                          onClick={() => onViewDetail(item.id)}>👁</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── DemoApp root ───────────────────────────────────────────────────
export default function DemoApp() {
  const [view, setView] = useState<'items' | 'detail'>('items');
  const [items, setItems] = useState<DemoItem[]>([]);
  const [quotationMap, setQuotationMap] = useState<Record<number, DemoQuotation[]>>({});
  const [detailId, setDetailId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  function handleDone(item: DemoItem, quotations: DemoQuotation[]) {
    setItems(prev => [...prev, item]);
    setQuotationMap(prev => ({ ...prev, [item.id]: quotations }));
    setShowModal(false);
    setDetailId(item.id);
    setView('detail');
  }

  const detailItem = items.find(i => i.id === detailId) ?? null;

  return (
    <div className="layout">
      <Sidebar activeView={view === 'detail' ? 'items' : view} onNavigate={() => setView('items')} />
      <div className="content">
        {view === 'items' && (
          <DemoItemList
            items={items}
            quotationMap={quotationMap}
            onAddItem={() => setShowModal(true)}
            onViewDetail={id => { setDetailId(id); setView('detail'); }}
          />
        )}
        {view === 'detail' && detailItem && (
          <DemoQuotationScreen
            item={detailItem}
            quotations={quotationMap[detailItem.id] ?? []}
            onBack={() => setView('items')}
          />
        )}
      </div>
      {showModal && (
        <DemoAddModal onClose={() => setShowModal(false)} onDone={handleDone} />
      )}
    </div>
  );
}
