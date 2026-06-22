import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSearch(trimmed);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Buscar produto (ex: notebook, smartphone...)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
      />
      <button type="submit" disabled={loading || !value.trim()}>
        {loading ? 'Buscando...' : 'Buscar'}
      </button>
    </form>
  );
}
