import { NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { OrganizationsService } from './organizations.service';

function fakeSupabase(responses: Array<{ data?: any; error?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      update: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      order: jest.fn(() => builder),
      single: jest.fn(() => Promise.resolve(result)),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

describe('OrganizationsService.getOwn', () => {
  it('devuelve la organización', async () => {
    const supabase = fakeSupabase([{ data: { id: 'org-1', name: 'Org' }, error: null }]);
    const service = new OrganizationsService(supabase);

    expect(await service.getOwn('org-1')).toEqual({ id: 'org-1', name: 'Org' });
  });

  it('lanza 404 si no existe', async () => {
    const supabase = fakeSupabase([{ data: null, error: null }]);
    const service = new OrganizationsService(supabase);

    await expect(service.getOwn('org-inexistente')).rejects.toThrow(NotFoundException);
  });
});

describe('OrganizationsService.updateOwn', () => {
  it('actualiza y devuelve la fila resultante', async () => {
    const supabase = fakeSupabase([{ data: { id: 'org-1', name: 'Nuevo nombre' }, error: null }]);
    const service = new OrganizationsService(supabase);

    const result = await service.updateOwn('org-1', { name: 'Nuevo nombre' } as any);

    expect(result).toEqual({ id: 'org-1', name: 'Nuevo nombre' });
    const builder = (supabase.db.from as jest.Mock).mock.results[0].value;
    expect(builder.update).toHaveBeenCalledWith({ name: 'Nuevo nombre' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'org-1');
  });
});

describe('OrganizationsService.listMembers', () => {
  it('sin equipos, devuelve lista vacía sin consultar members', async () => {
    const supabase = fakeSupabase([{ data: [], error: null }]);
    const service = new OrganizationsService(supabase);

    const result = await service.listMembers('org-1');

    expect(result).toEqual([]);
    expect((supabase.db.from as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['teams']);
  });

  it('junta los miembros activos de todos los equipos con el nombre de su equipo resuelto', async () => {
    const supabase = fakeSupabase([
      { data: [{ id: 'team-1', name: 'Producto' }, { id: 'team-2', name: 'Ventas' }], error: null },
      {
        data: [
          { id: 'm-1', name: 'Ana', channel: 'email', contact: 'ana@example.com', team_id: 'team-1', email_verified_at: null },
          { id: 'm-2', name: 'Bruno', channel: 'whatsapp', contact: '+34600', team_id: 'team-2', email_verified_at: '2026-01-01' },
        ],
        error: null,
      },
    ]);
    const service = new OrganizationsService(supabase);

    const result = await service.listMembers('org-1');

    expect(result).toEqual([
      expect.objectContaining({ id: 'm-1', team_name: 'Producto' }),
      expect.objectContaining({ id: 'm-2', team_name: 'Ventas' }),
    ]);
    const membersBuilder = (supabase.db.from as jest.Mock).mock.results[1].value;
    expect(membersBuilder.in).toHaveBeenCalledWith('team_id', ['team-1', 'team-2']);
  });
});
