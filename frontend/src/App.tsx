import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ItemList } from './components/ItemList';
import { SearchBar } from './components/SearchBar';
import { ResultsGrid } from './components/ResultsGrid';
import { searchProducts } from './api/search';
import type { SearchResponse } from './api/search';
import './App.css';

type View = 'items' | 'search';

export default function App() {
  const [view, setView] = useState<View>('items');

  // search state
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [lastQuery, setLastQuery] = useState('');

  async function handleSearch(query: string) {
    setLoading(true);
    setSearchError(null);
    setLastQuery(query);
    try {
      const result = await searchProducts(query);
      setSearchData(result);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Erro desconhecido');
      setSearchData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="layout">
      <Sidebar activeView={view} onNavigate={setView} />

      <div className="content">
        {view === 'items' && <ItemList />}

        {view === 'search' && (
          <div className="view">
            <div className="view__header">
              <div>
                <h1 className="view__title">Busca Rápida</h1>
                <p className="view__subtitle">Pesquise produtos nos marketplaces integrados</p>
              </div>
            </div>

            <div className="card card--padded">
              <SearchBar onSearch={handleSearch} loading={loading} />
            </div>

            {loading && (
              <div className="search-loading">
                <div className="spinner" />
                <p>Buscando em todos os marketplaces...</p>
              </div>
            )}

            {searchError && <div className="alert alert--error">{searchError}</div>}

            {searchData && !loading && (
              <>
                <p className="results-summary">
                  {searchData.results.length} resultado
                  {searchData.results.length !== 1 ? 's' : ''} para{' '}
                  <strong>"{lastQuery}"</strong>
                </p>
                <ResultsGrid data={searchData} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
