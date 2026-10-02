import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `goatcounterReady`/`pending` son estado a nivel de módulo (sección
// "count.js carga async" del propio archivo) — se reimporta con
// resetModules() en cada test para no filtrar estado entre ellos.
async function freshAnalytics() {
  vi.resetModules();
  return import('./analytics');
}

beforeEach(() => {
  delete (window as any).goatcounter;
});

afterEach(() => {
  delete (window as any).goatcounter;
});

describe('trackEvent / trackPageview — antes de que cargue goatcounter', () => {
  it('no hace nada (no lanza) si window.goatcounter todavía no existe', async () => {
    const { trackEvent, trackPageview } = await freshAnalytics();

    expect(() => trackEvent('signup')).not.toThrow();
    expect(() => trackPageview('/app')).not.toThrow();
  });

  it('encola la llamada y la dispara en orden al marcar goatcounter como listo', async () => {
    const { trackEvent, trackPageview, markGoatcounterReady } = await freshAnalytics();
    const count = vi.fn();

    trackEvent('signup');
    trackPageview('/app');
    expect(count).not.toHaveBeenCalled();

    (window as any).goatcounter = { count };
    markGoatcounterReady();

    expect(count).toHaveBeenCalledTimes(2);
    expect(count.mock.calls[0][0]).toEqual({ path: 'signup', title: 'signup', event: true });
    expect(count.mock.calls[1][0]).toEqual({ path: '/app' });
  });

  it('una vez listo, las llamadas siguientes van directas, sin pasar por la cola', async () => {
    const { trackEvent, markGoatcounterReady } = await freshAnalytics();
    const count = vi.fn();
    (window as any).goatcounter = { count };
    markGoatcounterReady();

    trackEvent('login');

    expect(count).toHaveBeenCalledTimes(1);
  });
});

describe('trackEvent — construcción del path con query params', () => {
  it('sin props, el path es solo el nombre del evento', async () => {
    const { trackEvent, markGoatcounterReady } = await freshAnalytics();
    const count = vi.fn();
    (window as any).goatcounter = { count };
    markGoatcounterReady();

    trackEvent('signup');

    expect(count).toHaveBeenCalledWith({ path: 'signup', title: 'signup', event: true });
  });

  it('con props, las codifica como query string, descartando las que son undefined', async () => {
    const { trackEvent, markGoatcounterReady } = await freshAnalytics();
    const count = vi.fn();
    (window as any).goatcounter = { count };
    markGoatcounterReady();

    trackEvent('checkout', { plan: 'equipo', amount: 49, promo: undefined });

    expect(count).toHaveBeenCalledWith({ path: 'checkout?plan=equipo&amount=49', title: 'checkout', event: true });
  });

  it('escapa caracteres especiales en claves y valores', async () => {
    const { trackEvent, markGoatcounterReady } = await freshAnalytics();
    const count = vi.fn();
    (window as any).goatcounter = { count };
    markGoatcounterReady();

    trackEvent('search', { 'q with space': 'a&b' });

    expect(count).toHaveBeenCalledWith({
      path: 'search?q%20with%20space=a%26b',
      title: 'search',
      event: true,
    });
  });
});
