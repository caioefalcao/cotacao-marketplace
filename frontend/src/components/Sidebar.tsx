interface SidebarProps {
  activeView: 'items' | 'search';
  onNavigate: (view: 'items' | 'search') => void;
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">S</div>
        <div>
          <div className="sidebar__logo-title">CotaFácil</div>
          <div className="sidebar__logo-sub">Sistema de Cotações</div>
        </div>
      </div>

      <nav className="sidebar__nav">
        <button
          className={`sidebar__nav-item${activeView === 'items' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('items')}
        >
          <span className="sidebar__nav-icon">≡</span>
          Lista de Itens
        </button>
        <button
          className={`sidebar__nav-item${activeView === 'search' ? ' sidebar__nav-item--active' : ''}`}
          onClick={() => onNavigate('search')}
        >
          <span className="sidebar__nav-icon">⌕</span>
          Busca Rápida
        </button>
      </nav>

      <div className="sidebar__footer">
        <span>IFMA • e-SNEAELIS</span>
      </div>
    </aside>
  );
}
