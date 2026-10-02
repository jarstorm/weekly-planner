import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { trackPageview } from '@/lib/analytics';
import { AnalyticsPageview } from './AnalyticsPageview';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackPageview: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnalyticsPageview — pedido explícito: trackear cada navegación client-side, no solo la carga inicial', () => {
  it('trackea la ruta actual al montar', () => {
    (usePathname as any).mockReturnValue('/app');

    render(<AnalyticsPageview />);

    expect(trackPageview).toHaveBeenCalledWith('/app');
  });

  it('trackea de nuevo cuando el pathname cambia (navegación SPA sin recarga)', () => {
    (usePathname as any).mockReturnValue('/app');
    const { rerender } = render(<AnalyticsPageview />);
    expect(trackPageview).toHaveBeenCalledTimes(1);

    (usePathname as any).mockReturnValue('/app/billing');
    rerender(<AnalyticsPageview />);

    expect(trackPageview).toHaveBeenCalledTimes(2);
    expect(trackPageview).toHaveBeenLastCalledWith('/app/billing');
  });

  it('no trackea de nuevo si el pathname no cambia entre renders', () => {
    (usePathname as any).mockReturnValue('/app');
    const { rerender } = render(<AnalyticsPageview />);
    expect(trackPageview).toHaveBeenCalledTimes(1);

    rerender(<AnalyticsPageview />);

    expect(trackPageview).toHaveBeenCalledTimes(1);
  });

  it('sin pathname (null), no llama a trackPageview', () => {
    (usePathname as any).mockReturnValue(null);

    render(<AnalyticsPageview />);

    expect(trackPageview).not.toHaveBeenCalled();
  });

  it('no renderiza nada en el DOM', () => {
    (usePathname as any).mockReturnValue('/app');

    const { container } = render(<AnalyticsPageview />);

    expect(container).toBeEmptyDOMElement();
  });
});
