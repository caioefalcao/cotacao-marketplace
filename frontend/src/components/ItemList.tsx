import { useEffect, useState, useCallback } from 'react';
import { listItems, deleteItem, triggerQuote } from '../api/items';
import type { ItemWithStats } from '../api/items';
import { AddItemModal } from './AddItemModal';

type FilterTab = 'all' | 'com' | 'sem';

interface ItemListProps {
  onViewDetail: (id: number) => void;
}

export function ItemList({ onViewDetail }: ItemListProps) {
  const [items, setItems] = useState<ItemWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [quotingIds, setQuotingIds] = useState<Set<number>>(new Set());
  const [lastQuery, setLastQuery] = useState<Record<number, string>>({});

  const refresh = useCallback(async () => {
    try {
      const data = await listItems();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleQuote(item: ItemWithStats) {
    setQuotingIds((prev) => new Set(prev).add(item.id));
    try {
      const result = await triggerQuote(item.id);
      if (result.search_query) {
        setLastQuery((prev) => ({ ...prev, [item.id]: result.search_query }));
      }
      await refresh();
    } finally {
      setQuotingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleDelete(item: ItemWithStats) {
    if (!confirm(`Remover "${item.name}" e todas as suas cotações?`)) return;
    await deleteItem(item.id);
    await refresh();
  }

  const filtered = items.filter((item) => {
    if (filter === 'com') return item.status === 'Com Cotações';
    if (filter === 'sem') return item.status === 'Sem Cotações';
    return true;
  });

  const counts = {
    all: items.length,
    com: items.filter((i) => i.status === 'Com Cotações').length,
    sem: items.filter((i) => i.status === 'Sem Cotações').length,
  };

  function formatPrice(p: number | null) {
    if (p === null) return '—';
    return p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <div className="view">
      <div className="view__header">
        <div>
          <h1 className="view__title">Lista de Materiais</h1>
          <p className="view__subtitle">Gerencie itens e dispare cotações automáticas</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>
          + Novo Item
        </button>
      </div>

      <div className="filter-tabs">
        {(['all', 'com', 'sem'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            className={`filter-tab${filter === tab ? ' filter-tab--active' : ''}`}
            onClick={() => setFilter(tab)}
          >
            {tab === 'all' ? 'Todos' : tab === 'com' ? 'Com Cotações' : 'Sem Cotações'}
            <span className="filter-tab__count">{counts[tab]}</span>
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="table-empty">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            {filter === 'all'
              ? 'Nenhum item cadastrado. Clique em "+ Novo Item" para começar.'
              : 'Nenhum item nesta categoria.'}
          </div>
        ) : (
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Nome do Item</th>
                <th>Categoria</th>
                <th>Mediana das Cotações</th>
                <th>Status</th>
                <th style={{ width: 120 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isQuoting = quotingIds.has(item.id);
                return (
                  <tr key={item.id} className={isQuoting ? 'row--quoting' : ''}>
                    <td className="text-muted">#{item.id}</td>
                    <td>
                      <div className="item-name">{item.name}</div>
                      {item.description && (
                        <div className="item-desc">{item.description}</div>
                      )}
                    </td>
                    <td className="text-muted">{item.category ?? '—'}</td>
                    <td className="price-cell">
                      {isQuoting ? (
                        <span className="quoting-spinner">Consultando IA e buscando...</span>
                      ) : (
                        <>
                          <span className="price-value">{formatPrice(item.median)}</span>
                          {item.quotation_count > 0 && (
                            <span className="price-count">
                              {item.quotation_count} cot.
                            </span>
                          )}
                          {lastQuery[item.id] && (
                            <div className="search-query-tag">
                              IA buscou: <em>"{lastQuery[item.id]}"</em>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          item.status === 'Com Cotações'
                            ? 'status-badge--success'
                            : 'status-badge--muted'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="action-btn action-btn--view"
                          title="Ver cotações"
                          onClick={() => onViewDetail(item.id)}
                        >
                          👁
                        </button>
                        <button
                          className={`action-btn action-btn--quote${isQuoting ? ' action-btn--loading' : ''}`}
                          title="Buscar cotações"
                          disabled={isQuoting}
                          onClick={() => handleQuote(item)}
                        >
                          {isQuoting ? '⟳' : '🔍'}
                        </button>
                        <button
                          className="action-btn action-btn--delete"
                          title="Remover item"
                          disabled={isQuoting}
                          onClick={() => handleDelete(item)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onDone={(itemId) => {
            setShowAddModal(false);
            refresh();
            onViewDetail(itemId);
          }}
        />
      )}

    </div>
  );
}
