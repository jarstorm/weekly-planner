'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// Fade-up genérico al entrar en viewport — mismo patrón que HeroVisual
// pero más sutil (sin blur/scale), para dar consistencia de movimiento a
// toda la landing sin competir con el hero. Se desactiva con
// prefers-reduced-motion vía CSS (globals.css), no hace falta en JS.
export function Reveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const directionClass = direction === 'left' ? ' reveal-left' : direction === 'right' ? ' reveal-right' : '';

  return (
    <div
      ref={ref}
      className={`reveal${directionClass}${revealed ? ' is-revealed' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
