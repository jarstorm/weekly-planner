import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../messages/es.json';

const listSurveysMock = vi.fn();
const getSurveyResultsMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/survey',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: {
    listSurveys: (...args: unknown[]) => listSurveysMock(...args),
    getSurveyResults: (...args: unknown[]) => getSurveyResultsMock(...args),
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
}));

import SurveyResultsPage from './page';

function results(overrides: Partial<{ surveyId: string; scheduledDate: string; questions: string[]; answersByQuestion: string[][]; submittedCount: number; totalActiveMembers: number; responseCount: number }> = {}) {
  return {
    surveyId: 'survey-1',
    scheduledDate: '2026-01-01',
    questions: ['¿Qué tal?', '¿Algo que mejorar?'],
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
  listSurveysMock.mockReset();
  getSurveyResultsMock.mockReset();
});

describe('SurveyResultsPage', () => {
  it('sin ninguna encuesta enviada: muestra el mensaje, sin selector ni resultados', async () => {
    listSurveysMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Todavía no se ha mandado ninguna encuesta.')).toBeInTheDocument());
    expect(screen.queryByLabelText('Encuesta')).not.toBeInTheDocument();
  });

  it('carga la encuesta más reciente por defecto y pide sus resultados', async () => {
    listSurveysMock.mockResolvedValue([
      { id: 'survey-2', scheduledDate: '2026-02-01', sentAt: '2026-02-01T10:00:00Z' },
      { id: 'survey-1', scheduledDate: '2026-01-01', sentAt: '2026-01-01T10:00:00Z' },
    ]);
    getSurveyResultsMock.mockResolvedValue(results());
    renderPage();

    await waitFor(() => expect(getSurveyResultsMock).toHaveBeenCalledWith('survey-2'));
    const select = screen.getByLabelText('Encuesta') as HTMLSelectElement;
    expect(select.value).toBe('survey-2');
  });

  it('muestra la participación y agrupa las respuestas por pregunta, nunca por persona', async () => {
    listSurveysMock.mockResolvedValue([{ id: 'survey-1', scheduledDate: '2026-01-01', sentAt: '2026-01-01T10:00:00Z' }]);
    getSurveyResultsMock.mockResolvedValue(results({ submittedCount: 2, totalActiveMembers: 3, answersByQuestion: [['Bien', 'Regular'], []] }));
    renderPage();

    await waitFor(() => expect(screen.getByText('2 de 3 personas respondieron')).toBeInTheDocument());
    expect(screen.getByText('Bien')).toBeInTheDocument();
    expect(screen.getByText('Regular')).toBeInTheDocument();
    expect(screen.getByText('Sin respuestas todavía para esta pregunta.')).toBeInTheDocument();
  });

  it('cambiar de encuesta en el selector pide los resultados de esa encuesta', async () => {
    listSurveysMock.mockResolvedValue([
      { id: 'survey-2', scheduledDate: '2026-02-01', sentAt: '2026-02-01T10:00:00Z' },
      { id: 'survey-1', scheduledDate: '2026-01-01', sentAt: '2026-01-01T10:00:00Z' },
    ]);
    getSurveyResultsMock.mockResolvedValue(results());
    renderPage();
    await waitFor(() => expect(getSurveyResultsMock).toHaveBeenCalledWith('survey-2'));

    fireEvent.change(screen.getByLabelText('Encuesta'), { target: { value: 'survey-1' } });

    await waitFor(() => expect(getSurveyResultsMock).toHaveBeenCalledWith('survey-1'));
  });

  it('fallo al cargar el listado de encuestas: muestra el error', async () => {
    listSurveysMock.mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los resultados de la encuesta.'));
  });
});
