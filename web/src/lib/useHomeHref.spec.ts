import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { api } from './api';
import { useHomeHref } from './useHomeHref';

vi.mock('./api', () => ({ api: { me: vi.fn() } }));

describe('useHomeHref', () => {
  it('empieza en "/" (portada) por defecto, antes de que resuelva /auth/me', () => {
    (api.me as any).mockReturnValue(new Promise(() => {})); // nunca resuelve en este test
    const { result } = renderHook(() => useHomeHref());

    expect(result.current).toBe('/');
  });

  it('con sesión válida (/auth/me resuelve), cambia a "/app"', async () => {
    (api.me as any).mockResolvedValue({ userId: 'u-1', email: 'a@b.com', organizationId: 'org-1' });
    const { result } = renderHook(() => useHomeHref());

    await waitFor(() => expect(result.current).toBe('/app'));
  });

  it('sin sesión (/auth/me rechaza con 401), se queda en "/" sin lanzar', async () => {
    (api.me as any).mockRejectedValue(new Error('401'));
    const { result } = renderHook(() => useHomeHref());

    await waitFor(() => expect(api.me).toHaveBeenCalled());
    expect(result.current).toBe('/');
  });
});
