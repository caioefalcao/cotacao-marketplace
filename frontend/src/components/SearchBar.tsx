import { useState } from 'react';

interface SearchBarProps {
  onSearch: (name: string, description?: string) => void;
  loading: boolean;
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSearch(trimmedName, description.trim() || undefined);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-bar__fields">
        <div className="field">
          <label className="field__label">
            Nome do produto <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            className="field__input"
            type="text"
            placeholder="Ex: Aparelho de exercício borboleta"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="field">
          <label className="field__label">
            Descrição técnica
            <span className="field__hint"> — opcional, a IA refina a busca com base nela</span>
          </label>
          <textarea
            className="field__input field__textarea"
            placeholder="Ex: Aparelho de exercício adutora tipo borboleta - Finalidade: fortalecimento muscular - Material: aço com mola revestido em PVC e espuma"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            rows={3}
          />
        </div>
      </div>

      <div className="search-bar__footer">
        <button type="submit" className="btn btn--primary" disabled={loading || !name.trim()}>
          {loading ? 'Buscando...' : 'Buscar nos marketplaces'}
        </button>
      </div>
    </form>
  );
}
