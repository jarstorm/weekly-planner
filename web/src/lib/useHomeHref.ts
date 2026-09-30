'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

// Sin sesión no sabemos si hay una cuenta detrás — por defecto la portada,
// y solo salta al dashboard si /auth/me confirma que hay cookie de sesión
// válida. Usado por BrandMark (logo, en todas las páginas) y por cualquier
// otro "volver al inicio" que deba respetar lo mismo (ver not-found.tsx).
export function useHomeHref(): '/' | '/app' {
  const [homeHref, setHomeHref] = useState<'/' | '/app'>('/');

  useEffect(() => {
    api.me().then(
      () => setHomeHref('/app'),
      () => {},
    );
  }, []);

  return homeHref;
}
