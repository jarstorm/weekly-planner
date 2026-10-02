import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../messages/es.json';
import { ApiError } from '@/lib/api';

const getCheckinFormMock = vi.fn();
const submitCheckinFormMock = vi.fn();

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: {
    getCheckinForm: (...args: unknown[]) => getCheckinFormMock(...args),
    submitCheckinForm: (...args: unknown[]) => submitCheckinFormMock(...args),
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

import CheckinFormPage from './page';

function renderPage() {
  (useParams as any).mockReturnValue({ token: 'tok-123' });
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <CheckinFormPage />
    </NextIntlClientProvider>,
  );
}

function baseInfo(overrides: Partial<{ memberName: string; teamName: string; weekStart: string; alreadySubmitted: boolean }> = {}) {
  return { memberName: 'Ana', teamName: 'Producto', weekStart: '2026-01-05', alreadySubmitted: false, ...overrides };
}

describe('CheckinFormPage', () => {
  it('token inválido: muestra el error, sin mostrar el formulario', async () => {
    getCheckinFormMock.mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Este enlace no es válido o ya expiró.'));
    expect(screen.queryByText('¿Qué has hecho esta semana?')).not.toBeInTheDocument();
  });

  it('token válido: muestra el saludo y el formulario con el nombre del equipo/miembro', async () => {
    getCheckinFormMock.mockResolvedValue(baseInfo());
    renderPage();

    await waitFor(() => expect(screen.getByText('Resumen semanal — Producto')).toBeInTheDocument());
    expect(screen.getByText(/Hola Ana/)).toBeInTheDocument();
  });

  it('ya respondido esta semana (alreadySubmitted): muestra el agradecimiento directo, sin formulario', async () => {
    getCheckinFormMock.mockResolvedValue(baseInfo({ alreadySubmitted: true }));
    renderPage();

    await waitFor(() => expect(screen.getByText(/¡Gracias, Ana!/)).toBeInTheDocument());
    expect(screen.queryByText('¿Qué has hecho esta semana?')).not.toBeInTheDocument();
  });

  it('solo "¿Qué has hecho?" es obligatorio — next/blocker son opcionales', async () => {
    getCheckinFormMock.mockResolvedValue(baseInfo());
    submitCheckinFormMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => screen.getByText('¿Qué has hecho esta semana?'));

    expect(screen.getByLabelText('¿Qué has hecho esta semana?')).toBeRequired();
    expect(screen.getByLabelText('¿Qué harás la semana que viene?')).not.toBeRequired();
    expect(screen.getByLabelText('¿Algo bloqueado o que necesites de alguien?')).not.toBeRequired();
  });

  it('enviar: manda los tres campos y muestra el agradecimiento', async () => {
    getCheckinFormMock.mockResolvedValue(baseInfo());
    submitCheckinFormMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => screen.getByText('¿Qué has hecho esta semana?'));

    fireEvent.change(screen.getByLabelText('¿Qué has hecho esta semana?'), { target: { value: 'Terminé la migración' } });
    fireEvent.change(screen.getByLabelText('¿Qué harás la semana que viene?'), { target: { value: 'Empezar el siguiente módulo' } });
    fireEvent.change(screen.getByLabelText('¿Algo bloqueado o que necesites de alguien?'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(screen.getByText(/¡Gracias, Ana!/)).toBeInTheDocument());
    expect(submitCheckinFormMock).toHaveBeenCalledWith('tok-123', {
      doneText: 'Terminé la migración',
      nextText: 'Empezar el siguiente módulo',
      blockerText: '',
    });
  });

  it('fallo al enviar: muestra el mensaje real del backend y no avanza a "gracias"', async () => {
    getCheckinFormMock.mockResolvedValue(baseInfo());
    submitCheckinFormMock.mockRejectedValue(new ApiError(400, 'Semana ya cerrada'));
    renderPage();
    await waitFor(() => screen.getByText('¿Qué has hecho esta semana?'));

    fireEvent.change(screen.getByLabelText('¿Qué has hecho esta semana?'), { target: { value: 'Terminé la migración' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Semana ya cerrada'));
    expect(screen.queryByText(/¡Gracias/)).not.toBeInTheDocument();
  });

  it('fallo al enviar que no es ApiError: mensaje genérico', async () => {
    getCheckinFormMock.mockResolvedValue(baseInfo());
    submitCheckinFormMock.mockRejectedValue(new Error('network down'));
    renderPage();
    await waitFor(() => screen.getByText('¿Qué has hecho esta semana?'));

    fireEvent.change(screen.getByLabelText('¿Qué has hecho esta semana?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo enviar la respuesta, prueba de nuevo.'));
  });
});
