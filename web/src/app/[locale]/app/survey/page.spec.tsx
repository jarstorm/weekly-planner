import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../messages/es.json';

const listSurveyPeriodsMock = vi.fn();
const getSurveyResultsMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/survey',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: {
    listSurveyPeriods: (...args: unknown[]) => listSurveyPeriodsMock(...args),
    getSurveyResults: (...args: unknown[]) => getSurveyResultsMock(...args),
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
}));

import SurveyResultsPage from './page';

function results(overrides: Partial<{ period: string; questions: string[]; answersByQuestion: string[][]; submittedCount: number; totalActiveMembers: number; responseCount: number }> = {}) {
  return {
    period: '2026-01-01',
    questions: ['¿Qué tal el mes?', '¿Algo que mejorar?'],
    answersByQuestion: [['Bien'], []],
    responseCount: 1,
    submittedCount: 1,
    totalActiveMembers: 3,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <SurveyResultsPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  listSurveyPeriodsMock.mockReset();
  getSurveyResultsMock.mockReset();
});

describe('SurveyResultsPage', () => {
  it('sin ningún período con respuestas: muestra el mensaje, sin selector ni resultados', async () => {
    listSurveyPeriodsMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Todavía no hay respuestas de ningún mes.')).toBeInTheDocument());
    expect(screen.queryByLabelText('Mes')).not.toBeInTheDocument();
  });

  it('carga el período más reciente por defecto y pide sus resultados', async () => {
    listSurveyPeriodsMock.mockResolvedValue(['2026-02-01', '2026-01-01']);
    getSurveyResultsMock.mockResolvedValue(results());
    renderPage();

    await waitFor(() => expect(getSurveyResultsMock).toHaveBeenCalledWith('2026-02-01'));
    const select = screen.getByLabelText('Mes') as HTMLSelectElement;
    expect(select.value).toBe('2026-02-01');
  });

  it('muestra la participación y agrupa las respuestas por pregunta, nunca por persona', async () => {
    listSurveyPeriodsMock.mockResolvedValue(['2026-01-01']);
    getSurveyResultsMock.mockResolvedValue(results({ submittedCount: 2, totalActiveMembers: 3, answersByQuestion: [['Bien', 'Regular'], []] }));
    renderPage();

    await waitFor(() => expect(screen.getByText('2 de 3 personas respondieron este mes')).toBeInTheDocument());
    expect(screen.getByText('Bien')).toBeInTheDocument();
    expect(screen.getByText('Regular')).toBeInTheDocument();
    expect(screen.getByText('Sin respuestas todavía para esta pregunta.')).toBeInTheDocument();
  });

  it('cambiar de período pide los resultados de ese mes', async () => {
    listSurveyPeriodsMock.mockResolvedValue(['2026-02-01', '2026-01-01']);
    getSurveyResultsMock.mockResolvedValue(results());
    renderPage();
    await waitFor(() => expect(getSurveyResultsMock).toHaveBeenCalledWith('2026-02-01'));

    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '2026-01-01' } });

    await waitFor(() => expect(getSurveyResultsMock).toHaveBeenCalledWith('2026-01-01'));
  });

  it('fallo al cargar los períodos: muestra el error', async () => {
    listSurveyPeriodsMock.mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los resultados de la encuesta.'));
  });
});
