import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../messages/es.json';

const getOrganizationMock = vi.fn();
const getPendingSurveyMock = vi.fn();
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
    getOrganization: (...args: unknown[]) => getOrganizationMock(...args),
    getPendingSurvey: (...args: unknown[]) => getPendingSurveyMock(...args),
    listSurveys: (...args: unknown[]) => listSurveysMock(...args),
    getSurveyResults: (...args: unknown[]) => getSurveyResultsMock(...args),
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
}));

import SurveyPage from './page';

function org(overrides: Partial<{ plan: 'equipo' | 'organizacion' | 'custom' }> = {}) {
  return {
    id: 'org-1',
    name: 'Acme',
    country: 'ES',
    contact_name: null,
    email: 'a@b.com',
    plan: 'organizacion' as const,
    max_teams: 5,
    max_members_per_team: 20,
    reminder_dow: 1,
    reminder_time: '10:00',
    cutoff_time: '13:00',
    timezone: 'Europe/Madrid',
    language: 'es' as const,
    has_executive_summary: false,
    executive_summary_recipients: [],
    ...overrides,
  };
}

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
      <SurveyPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  getOrganizationMock.mockReset();
  getPendingSurveyMock.mockReset().mockResolvedValue(null);
  listSurveysMock.mockReset().mockResolvedValue([]);
  getSurveyResultsMock.mockReset();
});

describe('SurveyPage — disponibilidad por plan', () => {
  it('Plan Equipo: muestra el aviso de no disponible, sin ofrecer nada de encuesta', async () => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'equipo' }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/no está disponible en tu plan actual/)).toBeInTheDocument());
    expect(screen.queryByText('Crear nueva encuesta')).not.toBeInTheDocument();
  });

  it('Plan Organización: ofrece la sección completa', async () => {
    getOrganizationMock.mockResolvedValue(org({ plan: 'organizacion' }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Ahora mismo no hay ninguna encuesta programada. Se crea una vez, se manda una vez — no se repite sola.')).toBeInTheDocument());
  });
});

describe('SurveyPage — crear/ver la pendiente', () => {
  beforeEach(() => {
    getOrganizationMock.mockReset().mockResolvedValue(org());
  });

  it('sin ninguna pendiente: ofrece el botón de crear una nueva, que lleva a /app/survey/new', async () => {
    getPendingSurveyMock.mockResolvedValue(null);
    renderPage();

    await waitFor(() => expect(screen.getByText('Crear nueva encuesta')).toBeInTheDocument());
    expect(screen.getByText('Crear nueva encuesta').closest('a')).toHaveAttribute('href', '/app/survey/new');
  });

  it('con una pendiente: muestra su fecha/hora/timezone, sin ofrecer el botón de crear otra', async () => {
    getPendingSurveyMock.mockResolvedValue({
      id: 'survey-1',
      questions: ['¿Qué tal?', '¿Algo que mejorar?'],
      scheduledDate: '2026-02-01',
      scheduledTime: '10:00',
      timezone: 'Europe/Madrid',
    });
    renderPage();

    await waitFor(() => expect(screen.getByText(/2026-02-01/)).toBeInTheDocument());
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
    expect(screen.queryByText('Crear nueva encuesta')).not.toBeInTheDocument();
  });
});

describe('SurveyPage — resultados de encuestas anteriores', () => {
  beforeEach(() => {
    getOrganizationMock.mockReset().mockResolvedValue(org());
  });

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
});

describe('SurveyPage — fallos de carga', () => {
  it('fallo al cargar la organización: muestra el error', async () => {
    getOrganizationMock.mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la encuesta.'));
  });
});
