import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const createSurveyMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });
const pushMock = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/survey/new',
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    createSurvey: (...args: unknown[]) => createSurveyMock(...args),
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import NewSurveyPage from './page';

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <NewSurveyPage />
    </NextIntlClientProvider>,
  );
}

function fillBaseFields() {
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2099-01-01' } });
  fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:00' } });
}

function addQuestion(text: string) {
  fireEvent.change(screen.getByPlaceholderText('Escribe una pregunta'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
}

beforeEach(() => {
  createSurveyMock.mockReset();
  pushMock.mockClear();
  (trackEvent as any).mockClear();
});

describe('NewSurveyPage', () => {
  it('sin ninguna pregunta añadida, no manda nada y muestra el aviso', () => {
    renderPage();
    fillBaseFields();

    fireEvent.click(screen.getByRole('button', { name: 'Crear encuesta' }));

    expect(screen.getByText('Añade al menos una pregunta')).toBeInTheDocument();
    expect(createSurveyMock).not.toHaveBeenCalled();
  });

  it('con fecha, hora, timezone y al menos una pregunta: crea la encuesta, trackea y vuelve a /app/survey', async () => {
    createSurveyMock.mockResolvedValue({ id: 'survey-1', questions: ['¿Qué tal?'], scheduledDate: '2099-01-01', scheduledTime: '10:00', timezone: 'Europe/Madrid' });
    renderPage();
    fillBaseFields();
    fireEvent.change(screen.getByLabelText('Zona horaria'), { target: { value: 'Europe/Madrid' } });
    addQuestion('¿Qué tal?');

    fireEvent.click(screen.getByRole('button', { name: 'Crear encuesta' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/app/survey'));
    expect(createSurveyMock).toHaveBeenCalledWith({
      questions: ['¿Qué tal?'],
      scheduledDate: '2099-01-01',
      scheduledTime: '10:00',
      timezone: 'Europe/Madrid',
    });
    expect(trackEvent).toHaveBeenCalledWith('survey_create');
  });

  it('fallo real del backend (p. ej. ya hay una pendiente): muestra el mensaje real, no navega', async () => {
    createSurveyMock.mockRejectedValue(new ApiError(409, 'Ya hay una encuesta pendiente de mandar'));
    renderPage();
    fillBaseFields();
    addQuestion('¿Qué tal?');

    fireEvent.click(screen.getByRole('button', { name: 'Crear encuesta' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ya hay una encuesta pendiente de mandar'));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('fallo que no es ApiError: mensaje genérico', async () => {
    createSurveyMock.mockRejectedValue(new Error('network down'));
    renderPage();
    fillBaseFields();
    addQuestion('¿Qué tal?');

    fireEvent.click(screen.getByRole('button', { name: 'Crear encuesta' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo crear la encuesta, prueba de nuevo'));
  });

  it('hasta 5 preguntas, como en el resto de la app', () => {
    renderPage();

    for (let i = 1; i <= 5; i++) {
      fireEvent.change(screen.getByPlaceholderText('Escribe una pregunta'), { target: { value: `Pregunta ${i}` } });
      fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    }

    expect(screen.queryByPlaceholderText('Escribe una pregunta')).not.toBeInTheDocument();
    expect(screen.getByText('Máximo 5 preguntas.')).toBeInTheDocument();
  });
});
