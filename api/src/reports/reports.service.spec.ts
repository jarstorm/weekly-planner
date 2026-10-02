import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PdfService } from '../pdf/pdf.service';
import { ReportsService } from './reports.service';

function fakeSupabase(responses: Array<{ data?: any; error?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      order: jest.fn(() => builder),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

function fakePdf(): { pdf: PdfService; fromMarkdown: jest.Mock } {
  const fromMarkdown = jest.fn().mockResolvedValue(Buffer.from('pdf'));
  return { pdf: { fromMarkdown } as unknown as PdfService, fromMarkdown };
}

describe('ReportsService.listForTeam — aislamiento entre organizaciones', () => {
  it('lanza 404 si el equipo no existe', async () => {
    const supabase = fakeSupabase([{ data: null, error: null }]);
    const service = new ReportsService(supabase, {} as PdfService);

    await expect(service.listForTeam('org-1', 'team-ajeno')).rejects.toThrow(NotFoundException);
  });

  it('lanza 403 si el equipo existe pero pertenece a otra organización', async () => {
    const supabase = fakeSupabase([{ data: { id: 'team-1', organization_id: 'org-ajena' }, error: null }]);
    const service = new ReportsService(supabase, {} as PdfService);

    await expect(service.listForTeam('org-1', 'team-1')).rejects.toThrow(ForbiddenException);
  });

  it('devuelve los informes del equipo, más reciente primero, solo si es de la propia organización', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'team-1', organization_id: 'org-1' }, error: null },
      { data: [{ id: 'rep-2', week_start: '2026-01-12' }, { id: 'rep-1', week_start: '2026-01-05' }], error: null },
    ]);
    const service = new ReportsService(supabase, {} as PdfService);

    const result = await service.listForTeam('org-1', 'team-1');

    expect(result).toEqual([{ id: 'rep-2', week_start: '2026-01-12' }, { id: 'rep-1', week_start: '2026-01-05' }]);
    const reportsBuilder = (supabase.db.from as jest.Mock).mock.results[1].value;
    expect(reportsBuilder.order).toHaveBeenCalledWith('week_start', { ascending: false });
  });
});

describe('ReportsService.listForOrg', () => {
  it('filtra directo por organization_id, sin resolver equipo', async () => {
    const supabase = fakeSupabase([{ data: [{ id: 'rep-exec-1' }], error: null }]);
    const service = new ReportsService(supabase, {} as PdfService);

    const result = await service.listForOrg('org-1');

    expect(result).toEqual([{ id: 'rep-exec-1' }]);
    const builder = (supabase.db.from as jest.Mock).mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith('organization_id', 'org-1');
  });
});

describe('ReportsService.getPdf — un informe no se descarga nunca cruzando organización', () => {
  it('lanza 404 si el informe no existe', async () => {
    const supabase = fakeSupabase([{ data: null, error: null }]);
    const { pdf } = fakePdf();
    const service = new ReportsService(supabase, pdf);

    await expect(service.getPdf('org-1', 'rep-inexistente')).rejects.toThrow(NotFoundException);
  });

  it('informe de equipo: 403 si el equipo del informe no es de la organización que lo pide', async () => {
    const supabase = fakeSupabase([
      {
        data: { id: 'rep-1', week_start: '2026-01-05', team_id: 'team-1', organization_id: null, teams: { name: 'Producto', organization_id: 'org-ajena' } },
        error: null,
      },
    ]);
    const { pdf, fromMarkdown } = fakePdf();
    const service = new ReportsService(supabase, pdf);

    await expect(service.getPdf('org-1', 'rep-1')).rejects.toThrow(ForbiddenException);
    expect(fromMarkdown).not.toHaveBeenCalled();
  });

  it('informe de equipo: genera el PDF con el título correcto si es de la propia organización', async () => {
    const supabase = fakeSupabase([
      {
        data: {
          id: 'rep-1',
          week_start: '2026-01-05',
          team_id: 'team-1',
          organization_id: null,
          content_markdown: '# Informe',
          teams: { name: 'Producto', organization_id: 'org-1' },
        },
        error: null,
      },
    ]);
    const { pdf, fromMarkdown } = fakePdf();
    const service = new ReportsService(supabase, pdf);

    const result = await service.getPdf('org-1', 'rep-1');

    expect(fromMarkdown).toHaveBeenCalledWith('# Informe', expect.stringContaining('Producto'));
    expect(result.filename).toBe('resumen-semanal-2026-01-05.pdf');
  });

  it('resumen ejecutivo (sin team_id): 403 si organization_id no coincide', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'rep-exec-1', week_start: '2026-01-05', team_id: null, organization_id: 'org-ajena', organizations: { name: 'Otra Org' } }, error: null },
    ]);
    const { pdf, fromMarkdown } = fakePdf();
    const service = new ReportsService(supabase, pdf);

    await expect(service.getPdf('org-1', 'rep-exec-1')).rejects.toThrow(ForbiddenException);
    expect(fromMarkdown).not.toHaveBeenCalled();
  });

  it('resumen ejecutivo: genera el PDF con el título correcto si es de la propia organización', async () => {
    const supabase = fakeSupabase([
      {
        data: {
          id: 'rep-exec-1',
          week_start: '2026-01-05',
          team_id: null,
          organization_id: 'org-1',
          content_markdown: '# Resumen',
          organizations: { name: 'Mi Org' },
        },
        error: null,
      },
    ]);
    const { pdf, fromMarkdown } = fakePdf();
    const service = new ReportsService(supabase, pdf);

    const result = await service.getPdf('org-1', 'rep-exec-1');

    expect(fromMarkdown).toHaveBeenCalledWith('# Resumen', expect.stringContaining('Mi Org'));
    expect(result.filename).toBe('resumen-ejecutivo-2026-01-05.pdf');
  });
});
