import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { api } from './api';
import { useEnabledChannels } from './useEnabledChannels';

vi.mock('./api', () => ({ api: { getEnabledChannels: vi.fn() } }));

describe('useEnabledChannels', () => {
  it('empieza con el default optimista (email/telegram sí, whatsapp no) antes de que resuelva el backend', () => {
    (api.getEnabledChannels as any).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEnabledChannels());

    expect(result.current).toEqual({ email: true, telegram: true, whatsapp: false });
  });

  it('cuando el backend confirma WhatsApp operativo, lo refleja', async () => {
    (api.getEnabledChannels as any).mockResolvedValue({ email: true, telegram: true, whatsapp: true });
    const { result } = renderHook(() => useEnabledChannels());

    await waitFor(() => expect(result.current.whatsapp).toBe(true));
  });

  it('sin conexión al backend (rechaza), se queda con el default en vez de romper el formulario', async () => {
    (api.getEnabledChannels as any).mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useEnabledChannels());

    await waitFor(() => expect(api.getEnabledChannels).toHaveBeenCalled());
    expect(result.current).toEqual({ email: true, telegram: true, whatsapp: false });
  });
});
