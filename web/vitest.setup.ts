import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// React Testing Library no limpia el DOM entre tests solo porque Vitest
// use un entorno jsdom (eso es automático con Jest, no con Vitest) — sin
// esto, varios render() en el mismo archivo van acumulando nodos y
// getByLabelText/getByText empiezan a fallar por "multiple elements
// found" en vez de por el test en sí.
afterEach(() => cleanup());
