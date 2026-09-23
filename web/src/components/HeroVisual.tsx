'use client';

import { useEffect, useRef, useState } from 'react';

// Reveal de scroll (estilo Apple: la imagen entra en escena al llegar al
// viewport, no solo con hover) + tilt 3D y glow que sigue el cursor, sobre
// la captura real del informe (report-sample-hero.png). Dos wrappers
// separados porque el reveal anima `transform`/`opacity` con transition y
// el flotado ambient (heroFloat) anima `transform` con @keyframes en el
// wrapper interior — en el mismo elemento, la animation gana siempre y la
// transition del reveal nunca se vería.
// Puramente decorativo — sección 5 del doc técnico, "hero con efecto wow"
// — se desactiva por CSS en móvil y con prefers-reduced-motion
// (globals.css), así que en JS no hace falta comprobar ninguno de los dos.
export function HeroVisual({ src, alt }: { src: string; alt: string }) {
  const revealRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = revealRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const el = tiltRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--tilt-x', `${(-y * 16).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${(x * 16).toFixed(2)}deg`);
    el.style.setProperty('--glow-x', `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--glow-y', `${((y + 0.5) * 100).toFixed(1)}%`);
  }

  function handleMouseLeave() {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
  }

  return (
    <div ref={revealRef} className={`hero-visual-reveal${revealed ? ' is-revealed' : ''}`}>
      <div
        className="hero-visual-tilt-wrap"
        ref={tiltRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="hero-visual-glow" aria-hidden="true" />
        <div className="hero-visual-photo hero-visual-tilt">
          <img src={src} alt={alt} />
          <div className="hero-visual-sheen" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
