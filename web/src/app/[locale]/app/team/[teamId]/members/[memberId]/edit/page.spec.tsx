import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../../../../../messages/es.json';
import { ApiError } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';

const listMembersMock = vi.fn();
const listTeamsMock = vi.fn();
const updateMemberMock = vi.fn();
const getTelegramBotUsernameMock = vi.fn().mockResolvedValue({ username: 'wf_bot' });
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });
const getEnabledChannelsMock = vi.fn().mockResolvedValue({ email: true, telegram: true, whatsapp: true });
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/team/team-1/members/member-1/edit',
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    listMembers: (...args: unknown[]) => listMembersMock(...args),
    listTeams: (...args: unknown[]) => listTeamsMock(...args),
    updateMember: (...args: unknown[]) => updateMemberMock(...args),
    getTelegramBotUsername: (...args: unknown[]) => getTelegramBotUsernameMock(...args),
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    getEnabledChannels: (...args: unknown[]) => getEnabledChannelsMock(...args),
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

import EditMemberPage from './page';

function member(overrides: Partial<{ id: string; team_id: string; name: string; channel: string; contact: string | null }> = {}) {
  return { id: 'member-1', team_id: 'team-1', name: 'Ana', channel: 'email', contact: 'ana@example.com', active: true, email_verified_at: null, ...overrides };
}

function renderPage() {
  (useParams as any).mockReturnValue({ teamId: 'team-1', memberId: 'member-1' });
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <EditMemberPage />
    </NextIntlClientProvider>,
  );
}

describe('EditMemberPage', () => {
  beforeEach(() => {
    listMembersMock.mockReset();
    listTeamsMock.mockReset().mockResolvedValue([{ id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] }]);
    updateMemberMock.mockReset();
    pushMock.mockClear();
    (trackEvent as any).mockClear();
  });

  it('member que no existe en este equipo: muestra el error, no el formulario', async () => {
    listMembersMock.mockResolvedValue([member({ id: 'otro-member' })]);
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Este miembro no existe o no pertenece a este equipo'));
  });

  it('con un solo equipo en la cuenta, no muestra el selector de "mover de equipo"', async () => {
    listMembersMock.mockResolvedValue([member()]);
    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('Ana')).toBeInTheDocument());
    expect(screen.queryByLabelText('Equipo')).not.toBeInTheDocument();
  });

  it('con varios equipos, mover a otro manda team_id en el update', async () => {
    listMembersMock.mockResolvedValue([member()]);
    listTeamsMock.mockResolvedValue([
      { id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] },
      { id: 'team-2', name: 'Ventas', company_context: '', report_recipients: [] },
    ]);
    updateMemberMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Equipo')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Equipo'), { target: { value: 'team-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/app/team/team-2/members'));
    expect(updateMemberMock).toHaveBeenCalledWith('team-1', 'member-1', {
      name: 'Ana',
      channel: 'email',
      contact: 'ana@example.com',
      team_id: 'team-2',
    });
  });

  it('sin mover de equipo, team_id va undefined en el payload (no se reenvía sin cambios)', async () => {
    listMembersMock.mockResolvedValue([member()]);
    updateMemberMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Ana')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(updateMemberMock).toHaveBeenCalled());
    expect(updateMemberMock).toHaveBeenCalledWith('team-1', 'member-1', {
      name: 'Ana',
      channel: 'email',
      contact: 'ana@example.com',
      team_id: undefined,
    });
    expect(trackEvent).toHaveBeenCalledWith('member_update');
  });

  it('miembro de canal telegram sin vincular: ofrece el link de vinculación con el username real del bot', async () => {
    listMembersMock.mockResolvedValue([member({ channel: 'telegram', contact: null })]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Todavía no ha vinculado Telegram.')).toBeInTheDocument());
    const link = screen.getByRole('link', { name: 'Vincular Telegram' });
    expect(link).toHaveAttribute('href', 'https://t.me/wf_bot?start=member-1');
  });

  it('miembro de canal telegram ya vinculado: ofrece "volver a vincular" en vez de "vincular"', async () => {
    listMembersMock.mockResolvedValue([member({ channel: 'telegram', contact: '12345' })]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Telegram vinculado ✓')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Volver a vincular Telegram' })).toBeInTheDocument();
  });

  it('fallo al guardar: muestra el mensaje real del backend, no navega', async () => {
    listMembersMock.mockResolvedValue([member()]);
    updateMemberMock.mockRejectedValue(new ApiError(400, 'Contacto inválido'));
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue('Ana')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Contacto inválido'));
    expect(pushMock).not.toHaveBeenCalled();
  });
});
