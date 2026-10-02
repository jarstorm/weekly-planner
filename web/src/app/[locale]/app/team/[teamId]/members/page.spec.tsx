import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useParams } from 'next/navigation';
import esMessages from '../../../../../../../messages/es.json';
import { trackEvent } from '@/lib/analytics';

const getTeamMock = vi.fn();
const listMembersMock = vi.fn();
const removeMemberMock = vi.fn();
const resendMemberVerificationMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/team/team-1/members',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    getTeam: (...args: unknown[]) => getTeamMock(...args),
    listMembers: (...args: unknown[]) => listMembersMock(...args),
    removeMember: (...args: unknown[]) => removeMemberMock(...args),
    resendMemberVerification: (...args: unknown[]) => resendMemberVerificationMock(...args),
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
}));

import TeamMembersPage from './page';

function member(overrides: Partial<ReturnType<typeof baseMember>> = {}) {
  return { ...baseMember(), ...overrides };
}
function baseMember() {
  return { id: 'm-1', team_id: 'team-1', name: 'Ana', channel: 'email' as const, contact: 'ana@example.com', active: true, email_verified_at: null as string | null };
}

function renderPage() {
  (useParams as any).mockReturnValue({ teamId: 'team-1' });
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <TeamMembersPage />
    </NextIntlClientProvider>,
  );
}

describe('TeamMembersPage', () => {
  beforeEach(() => {
    getTeamMock.mockReset().mockResolvedValue({ id: 'team-1', name: 'Producto', company_context: '', report_recipients: [] });
    listMembersMock.mockReset();
    removeMemberMock.mockReset();
    resendMemberVerificationMock.mockReset();
    (trackEvent as any).mockClear();
  });

  it('sin miembros, muestra el mensaje de "todavía no hay miembros"', async () => {
    listMembersMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Todavía no hay miembros en este equipo.')).toBeInTheDocument());
  });

  it('email verificado: muestra el check, sin botón de reenviar', async () => {
    listMembersMock.mockResolvedValue([member({ email_verified_at: '2026-01-01' })]);
    renderPage();

    await waitFor(() => expect(screen.getByTitle('Email verificado')).toBeInTheDocument());
    expect(screen.queryByTitle('Reenviar verificación')).not.toBeInTheDocument();
  });

  it('email sin verificar: ofrece reenviar, y cambia a "Enviado" tras hacerlo', async () => {
    listMembersMock.mockResolvedValue([member({ email_verified_at: null })]);
    resendMemberVerificationMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByText('Reenviar verificación')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Reenviar verificación'));

    await waitFor(() => expect(screen.getByText('Enviado')).toBeInTheDocument());
    expect(resendMemberVerificationMock).toHaveBeenCalledWith('team-1', 'm-1');
  });

  it('fallo al reenviar: muestra el error, no cambia a "Enviado"', async () => {
    listMembersMock.mockResolvedValue([member({ email_verified_at: null })]);
    resendMemberVerificationMock.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Reenviar verificación')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Reenviar verificación'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo reenviar el email de verificación'));
    expect(screen.queryByText('Enviado')).not.toBeInTheDocument();
  });

  it('miembro de telegram sin vincular todavía: muestra el aviso en vez de un contacto', async () => {
    listMembersMock.mockResolvedValue([member({ channel: 'telegram', contact: null })]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Todavía no ha vinculado Telegram.')).toBeInTheDocument());
  });

  it('miembro de whatsapp: muestra el contacto formateado con "+" y espacio', async () => {
    listMembersMock.mockResolvedValue([member({ channel: 'whatsapp', contact: '34670995609' })]);
    renderPage();

    await waitFor(() => expect(screen.getByText('+34 670995609')).toBeInTheDocument());
  });

  it('borrar un miembro: cancelar en el diálogo no quita nada', async () => {
    listMembersMock.mockResolvedValue([member()]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());

    // El botón de borrar es el único <button> dentro de la celda de acciones (editar es un <a>).
    const deleteButtons = screen.getAllByRole('button').filter((b) => b.closest('td')?.className.includes('actions'));
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('Cancelar'));

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(removeMemberMock).not.toHaveBeenCalled();
  });

  it('borrar un miembro: confirmar lo quita de la tabla y trackea el evento', async () => {
    listMembersMock.mockResolvedValue([member()]);
    removeMemberMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole('button').filter((b) => b.closest('td')?.className.includes('actions'));
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('Sí, quitar'));

    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument());
    expect(removeMemberMock).toHaveBeenCalledWith('team-1', 'm-1');
    expect(trackEvent).toHaveBeenCalledWith('member_remove');
  });

  it('fallo al cargar equipo o miembros: muestra el error en vez del esqueleto para siempre', async () => {
    getTeamMock.mockRejectedValue(new Error('404'));
    listMembersMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el equipo'));
  });
});
