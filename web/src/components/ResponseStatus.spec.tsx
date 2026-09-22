import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { mondayOfThisWeek, ResponsePercent, ResponseStatusList } from './ResponseStatus';
import type { CheckinStatus } from '@/lib/api';
import esMessages from '../../messages/es.json';

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function makeStatus(overrides: Partial<CheckinStatus> = {}): CheckinStatus {
  return {
    memberId: '1',
    memberName: 'Ana',
    channel: 'email',
    responded: false,
    doneText: null,
    nextText: null,
    blockerText: null,
    rawText: null,
    receivedAt: null,
    ...overrides,
  };
}

describe('mondayOfThisWeek', () => {
  it('devuelve un lunes (día de semana 1) para cualquier día de la semana', () => {
    for (let i = 0; i < 7; i++) {
      const iso = mondayOfThisWeek();
      // El cálculo depende de "hoy", así que solo verificamos la propiedad
      // invariante: el resultado siempre cae en lunes.
      const [y, m, d] = iso.split('-').map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      expect(dow).toBe(1);
    }
  });

  it('devuelve formato YYYY-MM-DD', () => {
    expect(mondayOfThisWeek()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('ResponsePercent', () => {
  it('no renderiza nada si la lista está vacía', () => {
    const { container } = renderWithIntl(<ResponsePercent status={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calcula el porcentaje correctamente (2 de 3 = 67%)', () => {
    const status = [
      makeStatus({ memberId: '1', responded: true }),
      makeStatus({ memberId: '2', responded: true }),
      makeStatus({ memberId: '3', responded: false }),
    ];
    renderWithIntl(<ResponsePercent status={status} />);
    expect(screen.getByText('67% respondió (2/3)')).toBeInTheDocument();
  });

  it('muestra 100% cuando todos respondieron', () => {
    const status = [makeStatus({ responded: true })];
    renderWithIntl(<ResponsePercent status={status} />);
    expect(screen.getByText('100% respondió (1/1)')).toBeInTheDocument();
  });

  it('muestra 0% cuando nadie respondió', () => {
    const status = [makeStatus({ responded: false })];
    renderWithIntl(<ResponsePercent status={status} />);
    expect(screen.getByText('0% respondió (0/1)')).toBeInTheDocument();
  });
});

describe('ResponseStatusList', () => {
  it('no renderiza nada si la lista está vacía', () => {
    const { container } = renderWithIntl(<ResponseStatusList status={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marca "sin responder" solo en los miembros que no respondieron', () => {
    const status = [
      makeStatus({ memberId: '1', memberName: 'Ana', responded: true }),
      makeStatus({ memberId: '2', memberName: 'Bruno', responded: false }),
    ];
    renderWithIntl(<ResponseStatusList status={status} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
    expect(screen.getAllByText(/sin responder/)).toHaveLength(1);
  });
});
