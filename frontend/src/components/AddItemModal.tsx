import { useState } from 'react';
import { createItem } from '../api/items';

interface AddItemModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function AddItemModal({ onClose, onCreated }: AddItemModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createItem({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar item');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>Novo Item</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal__form">
          {error && <div className="modal__error">{error}</div>}

          <label className="field">
            <span className="field__label">Nome do Item *</span>
            <input
              className="field__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Notebook Dell Inspiron 15"
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field__label">Descrição</span>
            <input
              className="field__input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Especificações adicionais"
            />
          </label>

          <label className="field">
            <span className="field__label">Categoria</span>
            <input
              className="field__input"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Informática, Esporte"
            />
          </label>

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading || !name.trim()}>
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
