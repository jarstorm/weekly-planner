import {
  executiveSummaryDeliveryText,
  localePrefix,
  reminderMessage,
  reportDeliveryText,
  surveyMessage,
} from './account-language';

describe('account-language', () => {
  it('reminderMessage en español por defecto, incluye el link', () => {
    const msg = reminderMessage('es', 'Ana', 'Producto', 'https://x/checkin/tok');
    expect(msg).toContain('Hola Ana');
    expect(msg).toContain('Producto');
    expect(msg).toContain('https://x/checkin/tok');
  });

  it('reminderMessage en inglés', () => {
    const msg = reminderMessage('en', 'Ana', 'Producto', 'https://x/checkin/tok');
    expect(msg).toContain('Hi Ana');
    expect(msg).not.toContain('Hola');
  });

  it('surveyMessage menciona el anonimato en ambos idiomas', () => {
    expect(surveyMessage('es', 'Ana', 'Acme', 'https://x/survey/tok')).toContain('anónima');
    expect(surveyMessage('en', 'Ana', 'Acme', 'https://x/survey/tok')).toContain('anonymous');
  });

  it('reportDeliveryText genera título/filename/caption coherentes por idioma', () => {
    const es = reportDeliveryText('es', 'Producto', '2026-09-21');
    expect(es.title).toBe('Resumen semanal — Producto — semana del 2026-09-21');
    expect(es.filename).toBe('resumen-semanal-2026-09-21.pdf');

    const en = reportDeliveryText('en', 'Producto', '2026-09-21');
    expect(en.title).toBe('Weekly summary — Producto — week of 2026-09-21');
    expect(en.filename).toBe('weekly-summary-2026-09-21.pdf');
  });

  it('executiveSummaryDeliveryText genera título/filename/caption coherentes por idioma', () => {
    const es = executiveSummaryDeliveryText('es', 'Acme', '2026-09-21');
    expect(es.title).toBe('Resumen ejecutivo — Acme — semana del 2026-09-21');
    expect(es.filename).toBe('resumen-ejecutivo-2026-09-21.pdf');

    const en = executiveSummaryDeliveryText('en', 'Acme', '2026-09-21');
    expect(en.title).toBe('Executive summary — Acme — week of 2026-09-21');
  });

  it('localePrefix: vacío para es (default sin prefijo), /en para inglés', () => {
    expect(localePrefix('es')).toBe('');
    expect(localePrefix('en')).toBe('/en');
  });
});
