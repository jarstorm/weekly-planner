// Placeholders de carga para las páginas del panel (AppShell) — sustituyen
// al "Cargando..." de texto plano, calcados a la forma real de cada página
// para que no haya salto de layout cuando llegan los datos.

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={`skeleton ${className}`} style={style} />;
}

export function DashboardSkeleton() {
  return (
    <>
      <div className="topbar">
        <Skeleton className="skeleton-title" style={{ marginBottom: 0 }} />
        <Skeleton className="skeleton-button" />
      </div>
      <div className="stats-row">
        {[0, 1, 2, 3].map((i) => (
          <div className="stat-card" key={i}>
            <Skeleton className="skeleton-icon" />
            <div style={{ flex: 1 }}>
              <Skeleton className="skeleton-text" style={{ width: '40%', height: '1.3rem' }} />
              <Skeleton className="skeleton-text" style={{ width: '70%' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="team-card-grid">
        {[0, 1, 2].map((i) => (
          <div className="team-card" key={i} style={{ cursor: 'default' }}>
            <Skeleton className="skeleton-icon" />
            <Skeleton className="skeleton-text" style={{ width: '65%', height: '1.05rem' }} />
            <Skeleton className="skeleton-text" style={{ width: '85%' }} />
          </div>
        ))}
      </div>
    </>
  );
}

export function SettingsSkeleton() {
  return (
    <>
      <Skeleton className="skeleton-title" />
      <div className="card">
        <Skeleton className="skeleton-text" style={{ width: '30%' }} />
        <Skeleton style={{ height: '2.5rem', margin: '0.4rem 0 1.1rem' }} />
        <Skeleton className="skeleton-text" style={{ width: '20%' }} />
        <Skeleton style={{ height: '2.5rem', margin: '0.4rem 0 1.1rem' }} />
        <Skeleton className="skeleton-button" />
      </div>
    </>
  );
}

export function TeamDetailSkeleton() {
  return (
    <>
      <div className="topbar">
        <Skeleton className="skeleton-title" style={{ marginBottom: 0 }} />
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <Skeleton className="skeleton-button" style={{ width: 130 }} />
          <Skeleton className="skeleton-button" style={{ width: 150 }} />
        </div>
      </div>
      <Skeleton className="skeleton-text" style={{ width: '25%', height: '1.2rem', margin: '1.5rem 0' }} />
      <div className="stats-row">
        {[0, 1, 2].map((i) => (
          <div className="stat-card" key={i}>
            <Skeleton className="skeleton-icon" />
            <div style={{ flex: 1 }}>
              <Skeleton className="skeleton-text" style={{ width: '40%', height: '1.3rem' }} />
              <Skeleton className="skeleton-text" style={{ width: '70%' }} />
            </div>
          </div>
        ))}
      </div>
      <ul className="report-list">
        {[0, 1].map((i) => (
          <li key={i}>
            <Skeleton className="skeleton-text" style={{ width: '35%', height: '1.1rem' }} />
            <Skeleton className="skeleton-text" style={{ width: '100%' }} />
            <Skeleton className="skeleton-text" style={{ width: '90%' }} />
            <Skeleton className="skeleton-text" style={{ width: '60%' }} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      <Skeleton className="skeleton-text" style={{ width: '30%', height: '1.5rem', marginBottom: '1.25rem' }} />
      <div className="card">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i}>
            <Skeleton className="skeleton-text" style={{ width: '25%' }} />
            <Skeleton style={{ height: '2.5rem', margin: '0.4rem 0 1.1rem' }} />
          </div>
        ))}
        <Skeleton className="skeleton-button" />
      </div>
    </>
  );
}

export function BillingSkeleton() {
  return (
    <>
      <Skeleton className="skeleton-title" />
      <div className="card">
        <Skeleton className="skeleton-text" style={{ width: '20%' }} />
        <Skeleton className="skeleton-text" style={{ width: '50%', height: '1.2rem' }} />
      </div>
      <ul className="pricing-grid">
        {[0, 1].map((i) => (
          <li key={i}>
            <Skeleton className="skeleton-text" style={{ width: '50%', height: '1.1rem' }} />
            <Skeleton className="skeleton-text" style={{ width: '35%', height: '1.4rem' }} />
            <Skeleton className="skeleton-text" style={{ width: '90%' }} />
            <Skeleton className="skeleton-button" style={{ width: '100%' }} />
          </li>
        ))}
      </ul>
    </>
  );
}
