import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ItemList } from './components/ItemList';
import { SearchBar } from './components/SearchBar';
import { ResultsGrid } from './components/ResultsGrid';
import { QuotationScreen } from './components/QuotationScreen';
import { searchProducts } from './api/search';
import type { SearchResponse } from './api/search';
import './App.css';

type View = 'items' | 'search' | 'detail';

export default function App() {
  const [view, setView] = useState<View>('items');
  const [detailItemId, setDetailItemId] = useState<number | null>(null);

  function openDetail(id: number) {
    setDetailItemId(id);
    setView('detail');
  }

  // search state
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  const [lastDescription, setLastDescription] = useState('');

  async function handleSearch(name: string, description?: string) {
    setLoading(true);
    setSearchError(null);
    setLastQuery(name);
    setLastDescription(description ?? '');
    try {
      const result = await searchProducts(name, description);
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
        {view === 'items' && <ItemList onViewDetail={openDetail} />}

        {view === 'detail' && detailItemId !== null && (
          <QuotationScreen
            itemId={detailItemId}
            onBack={() => setView('items')}
          />
        )}

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
                  {lastDescription && searchData.search_query !== lastQuery && (
                    <span className="results-summary__refined">
                      {' '}— IA buscou: <em>"{searchData.search_query}"</em>
                    </span>
                  )}
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
