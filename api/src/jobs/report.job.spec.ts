import { TeamsService } from '../teams/teams.service';
import { CheckinsService } from '../checkins/checkins.service';
import { ChannelsService } from '../channels/channels.service';
import { AggregateService } from '../aggregate/aggregate.service';
import { PdfService } from '../pdf/pdf.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ReportJob } from './report.job';

// now fijo: lunes 2026-01-05 10:00 UTC. dowInTimezone(now, 'UTC') === 1 (Mon),
// isWithinWindow(now, 'UTC', '10:00:00') === true.
const NOW = new Date('2026-01-05T10:00:00Z');
const WEEK_START = '2026-01-05';

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

function baseTeam(overrides: Record<string, any> = {}) {
  return {
    id: 'team-1',
    organization_id: 'org-1',
    name: 'Producto',
    company_context: '',
    language: 'es',
    timezone: 'UTC',
    reminder_dow: 1,
    cutoff_time: '10:00:00',
    report_recipients: ['owner@example.com'],
    ...overrides,
  };
}

function fakeTeams(allTeams: any[], membersByTeam: Record<string, any[]> = {}): TeamsService {
  return {
    listAll: jest.fn().mockResolvedValue(allTeams),
    listMembers: jest.fn((teamId: string) => Promise.resolve(membersByTeam[teamId] ?? [])),
  } as unknown as TeamsService;
}

function fakeCheckins(rowsByTeam: Record<string, any[]> = {}): CheckinsService {
  return {
    listForTeamWeek: jest.fn((teamId: string) => Promise.resolve(rowsByTeam[teamId] ?? [])),
  } as unknown as CheckinsService;
}

function fakeChannels() {
  const email = { send: jest.fn(), sendDocument: jest.fn().mockResolvedValue(undefined) };
  const channels = { get: jest.fn(() => email) } as unknown as ChannelsService;
  return { channels, email };
}

function fakeAggregate() {
  return {
    generateReport: jest.fn().mockResolvedValue('# Informe'),
    generateExecutiveSummary: jest.fn().mockResolvedValue('# Resumen ejecutivo'),
  } as unknown as AggregateService;
}

function fakePdf(): PdfService {
  return { fromMarkdown: jest.fn().mockResolvedValue(Buffer.from('pdf')) } as unknown as PdfService;
}

// Misma cola de respuestas que teams.service.spec.ts/retention.job.spec.ts,
// ampliada con in/order/limit para fetchPastBlockers y el join de informes
// del resumen ejecutivo.
function fakeSupabase(responses: Array<{ data?: any; error?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      lt: jest.fn(() => builder),
      order: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      insert: jest.fn(() => builder),
      update: jest.fn(() => builder),
      single: jest.fn(() => Promise.resolve(result)),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

describe('ReportJob — generación y entrega por equipo', () => {
  it('ignora equipos fuera de su día/hora de corte, sin tocar checkins ni IA', async () => {
    const team = baseTeam({ reminder_dow: 2 }); // hoy (lunes=1) no es su día
    const teams = fakeTeams([team]);
    const checkins = fakeCheckins();
    const { channels } = fakeChannels();
    const aggregate = fakeAggregate();
    const supabase = fakeSupabase([]);
    const job = new ReportJob(teams, checkins, channels, aggregate, fakePdf(), supabase);

    await job.run();

    expect(checkins.listForTeamWeek).not.toHaveBeenCalled();
    expect(aggregate.generateReport).not.toHaveBeenCalled();
    expect((supabase.db.from as jest.Mock)).not.toHaveBeenCalled();
  });

  it('no regenera un informe que ya existe para ese equipo/semana (idempotencia)', async () => {
    const team = baseTeam();
    const teams = fakeTeams([team]);
    const checkins = fakeCheckins();
    const { channels } = fakeChannels();
    const aggregate = fakeAggregate();
    const supabase = fakeSupabase([
      { data: { id: 'report-existing' }, error: null }, // reportExists
      { data: { id: 'org-1', name: 'Org', language: 'es', has_executive_summary: false }, error: null }, // organizations (resumen ejecutivo)
    ]);
    const job = new ReportJob(teams, checkins, channels, aggregate, fakePdf(), supabase);

    await job.run();

    expect(aggregate.generateReport).not.toHaveBeenCalled();
  });

  it('genera el informe, lo entrega por email a cada destinatario y marca delivered_at', async () => {
    const team = baseTeam({ report_recipients: ['a@example.com', 'b@example.com'] });
    const teams = fakeTeams([team], { 'team-1': [{ id: 'm-1', name: 'Ana' }, { id: 'm-2', name: 'Bruno' }] });
    const checkins = fakeCheckins({ 'team-1': [{ member_id: 'm-1', done_text: 'hecho', members: { name: 'Ana' } }] });
    const { channels, email } = fakeChannels();
    const aggregate = fakeAggregate();
    const pdf = fakePdf();
    const supabase = fakeSupabase([
      { data: null, error: null }, // reportExists -> no existe
      { data: [], error: null }, // fetchPastBlockers
      { data: null, error: null }, // insert reports
      { data: null, error: null }, // update delivered_at
      { data: { id: 'org-1', name: 'Org', language: 'es', has_executive_summary: false }, error: null }, // organizations
    ]);
    const job = new ReportJob(teams, checkins, channels, aggregate, pdf, supabase);

    await job.run();

    expect(aggregate.generateReport).toHaveBeenCalledWith(
      expect.objectContaining({ teamName: 'Producto', membersWithoutResponse: ['Bruno'] }),
    );
    expect(pdf.fromMarkdown).toHaveBeenCalledWith('# Informe', expect.any(String));
    expect(email.sendDocument).toHaveBeenCalledTimes(2);
    expect(email.sendDocument).toHaveBeenNthCalledWith(1, 'a@example.com', expect.any(Buffer), expect.any(String), expect.any(String));
    expect(email.sendDocument).toHaveBeenNthCalledWith(2, 'b@example.com', expect.any(Buffer), expect.any(String), expect.any(String));

    const updateBuilder = (supabase.db.from as jest.Mock).mock.results[3].value;
    expect(updateBuilder.update).toHaveBeenCalledWith({ delivered_at: expect.any(String) });
  });

  it('si el insert choca con otro tick concurrente (23505), descarta sin reintentar ni entregar', async () => {
    const team = baseTeam();
    const teams = fakeTeams([team], { 'team-1': [] });
    const checkins = fakeCheckins();
    const { channels, email } = fakeChannels();
    const aggregate = fakeAggregate();
    const supabase = fakeSupabase([
      { data: null, error: null }, // reportExists -> no existe
      { data: [], error: null }, // fetchPastBlockers
      { data: null, error: { code: '23505' } }, // insert choca con el otro tick
      { data: { id: 'org-1', name: 'Org', language: 'es', has_executive_summary: false }, error: null }, // organizations
    ]);
    const job = new ReportJob(teams, checkins, channels, aggregate, fakePdf(), supabase);

    await job.run();

    expect(email.sendDocument).not.toHaveBeenCalled();
  });

  it('un fallo generando o entregando el informe de un equipo no interrumpe el resto', async () => {
    const teamA = baseTeam({ id: 'team-a', organization_id: 'org-a' });
    const teamB = baseTeam({ id: 'team-b', organization_id: 'org-b' });
    const teams = fakeTeams([teamA, teamB], { 'team-a': [], 'team-b': [] });
    const checkins = fakeCheckins();
    const { channels, email } = fakeChannels();
    const aggregate = {
      generateReport: jest
        .fn()
        .mockRejectedValueOnce(new Error('Claude 503'))
        .mockResolvedValueOnce('# Informe B'),
      generateExecutiveSummary: jest.fn(),
    } as unknown as AggregateService;
    const supabase = fakeSupabase([
      { data: null, error: null }, // reportExists team-a
      { data: [], error: null }, // fetchPastBlockers team-a
      // generateReport de team-a lanza antes de llegar al insert
      { data: null, error: null }, // reportExists team-b
      { data: [], error: null }, // fetchPastBlockers team-b
      { data: null, error: null }, // insert reports team-b
      { data: null, error: null }, // update delivered_at team-b
      { data: { id: 'org-a', name: 'A', language: 'es', has_executive_summary: false }, error: null },
      { data: { id: 'org-b', name: 'B', language: 'es', has_executive_summary: false }, error: null },
    ]);
    const job = new ReportJob(teams, checkins, channels, aggregate, fakePdf(), supabase);

    await job.run();

    expect(email.sendDocument).toHaveBeenCalledTimes(1);
  });
});

describe('ReportJob — resumen ejecutivo', () => {
  function orgRow(overrides: Record<string, any> = {}) {
    return { id: 'org-1', name: 'Org', language: 'es', has_executive_summary: true, executive_summary_recipients: ['jefe@example.com'], ...overrides };
  }

  it('no genera resumen si la organización no lo tiene activado', async () => {
    const team = baseTeam({ report_recipients: [] });
    const teams = fakeTeams([team], { 'team-1': [] });
    const checkins = fakeCheckins();
    const { channels } = fakeChannels();
    const aggregate = fakeAggregate();
    const supabase = fakeSupabase([
      { data: null, error: null }, // reportExists
      { data: [], error: null }, // fetchPastBlockers
      { data: null, error: null }, // insert reports
      { data: { id: 'org-1', name: 'Org', language: 'es', has_executive_summary: false }, error: null }, // organizations
    ]);
    const job = new ReportJob(teams, checkins, channels, aggregate, fakePdf(), supabase);

    await job.run();

    expect(aggregate.generateExecutiveSummary).not.toHaveBeenCalled();
  });

  it('no genera resumen con un solo equipo en la organización (nada que consolidar)', async () => {
    const team = baseTeam({ report_recipients: [] });
    const teams = fakeTeams([team], { 'team-1': [] });
    const checkins = fakeCheckins();
    const { channels } = fakeChannels();
    const aggregate = fakeAggregate();
    const supabase = fakeSupabase([
      { data: null, error: null }, // reportExists
      { data: [], error: null }, // fetchPastBlockers
      { data: null, error: null }, // insert reports
      { data: orgRow(), error: null }, // organizations
      { data: null, error: null }, // orgReportExists -> no existe
      { data: [{ id: 'team-1', name: 'Producto' }], error: null }, // teams de la organización: solo 1
    ]);
    const job = new ReportJob(teams, checkins, channels, aggregate, fakePdf(), supabase);

    await job.run();

    expect(aggregate.generateExecutiveSummary).not.toHaveBeenCalled();
  });

  it('espera a que TODOS los equipos tengan informe de la semana antes de consolidar', async () => {
    const team = baseTeam({ report_recipients: [] });
    const teams = fakeTeams([team], { 'team-1': [] });
    const checkins = fakeCheckins();
    const { channels } = fakeChannels();
    const aggregate = fakeAggregate();
    const supabase = fakeSupabase([
      { data: null, error: null }, // reportExists
      { data: [], error: null }, // fetchPastBlockers
      { data: null, error: null }, // insert reports
      { data: orgRow(), error: null }, // organizations
      { data: null, error: null }, // orgReportExists
      { data: [{ id: 'team-1', name: 'Producto' }, { id: 'team-2', name: 'Ventas' }], error: null }, // 2 equipos
      { data: [{ id: 'rep-1', team_id: 'team-1', content_markdown: 'x' }], error: null }, // solo 1 informe de los 2
    ]);
    const job = new ReportJob(teams, checkins, channels, aggregate, fakePdf(), supabase);

    await job.run();

    expect(aggregate.generateExecutiveSummary).not.toHaveBeenCalled();
  });

  it('genera y entrega el resumen ejecutivo cuando todos los equipos ya tienen informe', async () => {
    const team = baseTeam({ report_recipients: [] });
    const teams = fakeTeams([team], { 'team-1': [] });
    const checkins = fakeCheckins();
    const { channels, email } = fakeChannels();
    const aggregate = fakeAggregate();
    const pdf = fakePdf();
    const supabase = fakeSupabase([
      { data: null, error: null }, // reportExists
      { data: [], error: null }, // fetchPastBlockers
      { data: null, error: null }, // insert reports (equipo)
      { data: orgRow(), error: null }, // organizations
      { data: null, error: null }, // orgReportExists -> no existe
      { data: [{ id: 'team-1', name: 'Producto' }, { id: 'team-2', name: 'Ventas' }], error: null }, // 2 equipos
      {
        data: [
          { id: 'rep-1', team_id: 'team-1', content_markdown: 'Informe 1' },
          { id: 'rep-2', team_id: 'team-2', content_markdown: 'Informe 2' },
        ],
        error: null,
      }, // los 2 informes ya existen
      { data: null, error: null }, // insert reports (resumen ejecutivo)
      { data: null, error: null }, // update delivered_at (resumen ejecutivo)
    ]);
    const job = new ReportJob(teams, checkins, channels, aggregate, pdf, supabase);

    await job.run();

    expect(aggregate.generateExecutiveSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationName: 'Org',
        teamReports: [
          { teamName: 'Producto', contentMarkdown: 'Informe 1' },
          { teamName: 'Ventas', contentMarkdown: 'Informe 2' },
        ],
      }),
    );
    expect(email.sendDocument).toHaveBeenCalledWith('jefe@example.com', expect.any(Buffer), expect.any(String), expect.any(String));
  });

  it('si el insert del resumen choca con otra ejecución concurrente (23505), no reintenta ni entrega', async () => {
    const team = baseTeam({ report_recipients: [] });
    const teams = fakeTeams([team], { 'team-1': [] });
    const checkins = fakeCheckins();
    const { channels, email } = fakeChannels();
    const aggregate = fakeAggregate();
    const supabase = fakeSupabase([
      { data: null, error: null }, // reportExists
      { data: [], error: null }, // fetchPastBlockers
      { data: null, error: null }, // insert reports (equipo)
      { data: orgRow(), error: null }, // organizations
      { data: null, error: null }, // orgReportExists
      { data: [{ id: 'team-1', name: 'Producto' }, { id: 'team-2', name: 'Ventas' }], error: null },
      {
        data: [
          { id: 'rep-1', team_id: 'team-1', content_markdown: 'Informe 1' },
          { id: 'rep-2', team_id: 'team-2', content_markdown: 'Informe 2' },
        ],
        error: null,
      },
      { data: null, error: { code: '23505' } }, // insert resumen choca
    ]);
    const job = new ReportJob(teams, checkins, channels, aggregate, fakePdf(), supabase);

    await job.run();

    expect(email.sendDocument).not.toHaveBeenCalled();
  });
});

describe('ReportJob — fecha fija usada en todos los tests', () => {
  it('NOW cae exactamente en la ventana del cutoff_time configurado (sanity check del fixture)', () => {
    expect(NOW.toISOString()).toBe('2026-01-05T10:00:00.000Z');
    expect(WEEK_START).toBe('2026-01-05');
  });
});
