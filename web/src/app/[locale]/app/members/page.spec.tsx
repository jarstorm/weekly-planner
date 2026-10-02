import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../../../../../messages/es.json';

const listAllMembersMock = vi.fn();
const removeMemberMock = vi.fn();
const resendMemberVerificationMock = vi.fn();
const billingStatusMock = vi.fn().mockResolvedValue({ plan_selected: true });

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app/members',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/lib/api', () => ({
  api: {
    listAllMembers: (...args: unknown[]) => listAllMembersMock(...args),
    removeMember: (...args: unknown[]) => removeMemberMock(...args),
    resendMemberVerification: (...args: unknown[]) => resendMemberVerificationMock(...args),
    billingStatus: (...args: unknown[]) => billingStatusMock(...args),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('no session in test')),
  },
}));

import AllMembersPage from './page';

function member(overrides: Partial<{ id: string; team_id: string; team_name: string; name: string; channel: 'email' | 'whatsapp' | 'telegram'; contact: string | null; email_verified_at: string | null }> = {}) {
  return {
    id: 'm-1',
    team_id: 'team-1',
    team_name: 'Producto',
    name: 'Ana',
    channel: 'email' as const,
    contact: 'ana@example.com',
    email_verified_at: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <AllMembersPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  listAllMembersMock.mockReset();
  removeMemberMock.mockReset();
  resendMemberVerificationMock.mockReset();
});

describe('AllMembersPage', () => {
  it('sin miembros en ningún equipo: muestra el mensaje de vacío, sin filtros ni tabla', async () => {
    listAllMembersMock.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText('Todavía no hay miembros en ningún equipo.')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('Buscar por nombre')).not.toBeInTheDocument();
  });

  it('filtro por nombre: busca sin distinguir mayúsculas, por substring', async () => {
    listAllMembersMock.mockResolvedValue([member({ id: 'm-1', name: 'Ana' }), member({ id: 'm-2', name: 'Bruno' })]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Bruno')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre'), { target: { value: 'an' } });

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText('Bruno')).not.toBeInTheDocument();
  });

  it('filtro por equipo: solo muestra los miembros de ese equipo, con opciones deduplicadas', async () => {
    listAllMembersMock.mockResolvedValue([
      member({ id: 'm-1', name: 'Ana', team_id: 'team-1', team_name: 'Producto' }),
      member({ id: 'm-2', name: 'Bruno', team_id: 'team-2', team_name: 'Ventas' }),
      member({ id: 'm-3', name: 'Carla', team_id: 'team-1', team_name: 'Producto' }),
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Bruno')).toBeInTheDocument());

    const teamSelect = screen.getByDisplayValue('Todos los equipos');
    expect(teamSelect.querySelectorAll('option')).toHaveLength(3); // "todos" + Producto + Ventas, sin duplicar

    fireEvent.change(teamSelect, { target: { value: 'team-1' } });

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Carla')).toBeInTheDocument();
    expect(screen.queryByText('Bruno')).not.toBeInTheDocument();
  });

  it('sin coincidencias con el filtro: muestra el aviso en vez de una tabla vacía', async () => {
    listAllMembersMock.mockResolvedValue([member({ name: 'Ana' })]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre'), { target: { value: 'zzz' } });

    expect(screen.getByText('Ningún miembro coincide con el filtro.')).toBeInTheDocument();
  });

  it('miembro de whatsapp: contacto formateado con "+"', async () => {
    listAllMembersMock.mockResolvedValue([member({ channel: 'whatsapp', contact: '34670995609' })]);
    renderPage();

    await waitFor(() => expect(screen.getByText('+34 670995609')).toBeInTheDocument());
  });

  it('email sin verificar: reenviar cambia a "Enviado"', async () => {
    listAllMembersMock.mockResolvedValue([member({ email_verified_at: null })]);
    resendMemberVerificationMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByText('Reenviar verificación')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Reenviar verificación'));

    await waitFor(() => expect(screen.getByText('Enviado')).toBeInTheDocument());
    expect(resendMemberVerificationMock).toHaveBeenCalledWith('team-1', 'm-1');
  });

  it('borrar un miembro: confirmar lo quita de la tabla', async () => {
    listAllMembersMock.mockResolvedValue([member()]);
    removeMemberMock.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole('button').filter((b) => b.closest('td')?.className.includes('actions'));
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText('Sí, quitar'));

    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument());
    expect(removeMemberMock).toHaveBeenCalledWith('team-1', 'm-1');
  });

  it('fallo al cargar: muestra el error, no la tabla', async () => {
    listAllMembersMock.mockRejectedValue(new Error('404'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el listado.'));
  });
});
