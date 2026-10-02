import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../messages/es.json';
import { ApiError } from '@/lib/api';

const getSurveyFormMock = vi.fn();
const submitSurveyFormMock = vi.fn();

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: {
    getSurveyForm: (...args: unknown[]) => getSurveyFormMock(...args),
    submitSurveyForm: (...args: unknown[]) => submitSurveyFormMock(...args),
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

import SurveyFormPage from './page';

function renderPage() {
  (useParams as any).mockReturnValue({ token: 'tok-123' });
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <SurveyFormPage />
    </NextIntlClientProvider>,
  );
}

function baseInfo(overrides: Partial<{ memberName: string; organizationName: string; questions: string[]; alreadySubmitted: boolean }> = {}) {
  return {
    memberName: 'Ana',
    organizationName: 'Acme',
    questions: ['¿Qué tal el mes?', '¿Algo que mejorar?'],
    alreadySubmitted: false,
    ...overrides,
  };
}

describe('SurveyFormPage', () => {
  it('token inválido: muestra el error', async () => {
    getSurveyFormMock.mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Este enlace no es válido o la encuesta ya no está activa.'));
  });

  it('token válido: muestra el aviso de anonimato y una pregunta por cada una de la organización', async () => {
    getSurveyFormMock.mockResolvedValue(baseInfo());
    renderPage();

    await waitFor(() => expect(screen.getByText('Encuesta de Acme')).toBeInTheDocument());
    expect(screen.getByText(/Tus respuestas son anónimas/)).toBeInTheDocument();
    expect(screen.getByLabelText('¿Qué tal el mes?')).toBeInTheDocument();
    expect(screen.getByLabelText('¿Algo que mejorar?')).toBeInTheDocument();
  });

  it('ya respondido este mes: agradecimiento directo, sin preguntas', async () => {
    getSurveyFormMock.mockResolvedValue(baseInfo({ alreadySubmitted: true }));
    renderPage();

    await waitFor(() => expect(screen.getByText('Gracias por tu respuesta.')).toBeInTheDocument());
    expect(screen.queryByText('¿Qué tal el mes?')).not.toBeInTheDocument();
  });

  it('escribir en una pregunta no pisa la respuesta de las demás (array de respuestas por índice)', async () => {
    getSurveyFormMock.mockResolvedValue(baseInfo());
    renderPage();
    await waitFor(() => screen.getByText('¿Qué tal el mes?'));

    fireEvent.change(screen.getByLabelText('¿Qué tal el mes?'), { target: { value: 'Bien' } });
    fireEvent.change(screen.getByLabelText('¿Algo que mejorar?'), { target: { value: 'Más comunicación' } });

    expect((screen.getByLabelText('¿Qué tal el mes?') as HTMLTextAreaElement).value).toBe('Bien');
    expect((screen.getByLabelText('¿Algo que mejorar?') as HTMLTextAreaElement).value).toBe('Más comunicación');
  });

  it('enviar: manda las respuestas en el mismo orden que las preguntas, respuestas vacías incluidas', async () => {
    getSurveyFormMock.mockResolvedValue(baseInfo());
    submitSurveyFormMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => screen.getByText('¿Qué tal el mes?'));

    fireEvent.change(screen.getByLabelText('¿Qué tal el mes?'), { target: { value: 'Bien' } });
    // "¿Algo que mejorar?" se deja vacía a propósito — ninguna pregunta es obligatoria.
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(screen.getByText('Gracias por tu respuesta.')).toBeInTheDocument());
    expect(submitSurveyFormMock).toHaveBeenCalledWith('tok-123', ['Bien', '']);
  });

  it('ninguna pregunta es obligatoria (sin required en los textarea)', async () => {
    getSurveyFormMock.mockResolvedValue(baseInfo());
    renderPage();
    await waitFor(() => screen.getByText('¿Qué tal el mes?'));

    expect(screen.getByLabelText('¿Qué tal el mes?')).not.toBeRequired();
    expect(screen.getByLabelText('¿Algo que mejorar?')).not.toBeRequired();
  });

  it('fallo al enviar: muestra el mensaje real del backend, no avanza a "gracias"', async () => {
    getSurveyFormMock.mockResolvedValue(baseInfo());
    submitSurveyFormMock.mockRejectedValue(new ApiError(403, 'Ya has respondido la encuesta de este mes'));
    renderPage();
    await waitFor(() => screen.getByText('¿Qué tal el mes?'));

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ya has respondido la encuesta de este mes'));
    expect(screen.queryByText('Gracias por tu respuesta.')).not.toBeInTheDocument();
  });
});
