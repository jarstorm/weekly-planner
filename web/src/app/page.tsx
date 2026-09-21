export default function LandingPage() {
  return (
    <main className="page">
      <nav className="topbar">
        <strong>WeeklyFeedback</strong>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <a className="btn btn-secondary" href="/login">Entrar</a>
          <a className="btn btn-primary" href="/register">Crear cuenta</a>
        </div>
      </nav>

      <section className="hero">
        <h1>WeeklyFeedback</h1>
        <p className="tagline">
          El resumen semanal que tu equipo ya no tiene que escribir, y que tú ya no tienes que resumir.
        </p>
        <p>
          Cada semana le preguntamos a cada persona de tu equipo tres cosas cortas — qué hizo, qué hará, si tiene
          algún bloqueo — por WhatsApp o email. Con las respuestas armamos un único informe narrativo, listo para
          leer en 30 segundos.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/register">Crear cuenta</a>
        </div>
      </section>

      <h2>Cómo funciona</h2>
      <ol className="steps">
        <li>Das de alta tu equipo y elegís día/hora del recordatorio.</li>
        <li>Cada persona responde una vez por semana, en el canal que ya usa.</li>
        <li>Recibís un informe único, agrupado por proyecto, con bloqueos y prioridades.</li>
      </ol>

      <h2>Precios</h2>
      <ul className="pricing-grid">
        <li>
          <strong>Plan Equipo</strong>
          <span className="price">49€/mes</span>
          <p style={{ margin: '0.5rem 0 0' }}>Un equipo, hasta 20 personas.</p>
        </li>
        <li>
          <strong>Plan Organización</strong>
          <span className="price">149€/mes</span>
          <p style={{ margin: '0.5rem 0 0' }}>Hasta 5 equipos, resumen ejecutivo opcional.</p>
        </li>
      </ul>
      <p className="muted-link">Precios sin IVA. Sin permanencia, cancelable en cualquier momento.</p>
    </main>
  );
}
