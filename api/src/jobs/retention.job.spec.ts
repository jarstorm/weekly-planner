import { SupabaseService } from '../supabase/supabase.service';
import { AudioService } from '../audio/audio.service';
import { RetentionJob } from './retention.job';

function fakeAudio(): AudioService {
  return { remove: jest.fn() } as unknown as AudioService;
}

// Mismo patrón de cola de respuestas que teams.service.spec.ts.
function fakeSupabase(responses: Array<{ data?: any; error?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      lt: jest.fn(() => builder),
      not: jest.fn(() => builder),
      delete: jest.fn(() => builder),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

describe('RetentionJob', () => {
  it('no hace nada si ninguna organización tiene retención configurada', async () => {
    const supabase = fakeSupabase([{ data: [], error: null }]);
    const job = new RetentionJob(supabase, fakeAudio());

    await job.run();

    expect((supabase.db.from as jest.Mock).mock.calls.length).toBe(1);
  });

  it('borra checkins e informes de equipo anteriores al corte, para cada equipo de la organización, y limpia los audios huérfanos de Storage', async () => {
    const supabase = fakeSupabase([
      { data: [{ id: 'org-1', history_retention_months: 1 }], error: null }, // organizations con retención
      { data: [{ id: 'team-1' }, { id: 'team-2' }], error: null }, // teams de org-1
      { data: [{ audio_paths: ['a.ogg', 'b.ogg'] }, { audio_paths: [] }], error: null }, // select audio_paths a purgar
      { data: null, error: null }, // delete checkins
      { data: null, error: null }, // delete reports (team)
      { data: null, error: null }, // delete reports (organization, resumen ejecutivo)
      { data: null, error: null }, // delete survey_responses
      { data: null, error: null }, // delete survey_submissions
    ]);
    const audio = fakeAudio();
    const job = new RetentionJob(supabase, audio);

    await job.run();

    const calls = (supabase.db.from as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls).toEqual(['organizations', 'teams', 'checkins', 'checkins', 'reports', 'reports', 'survey_responses', 'survey_submissions']);
    expect(audio.remove).toHaveBeenCalledWith(['a.ogg', 'b.ogg']);

    const checkinsDeleteBuilder = (supabase.db.from as jest.Mock).mock.results[3].value;
    expect(checkinsDeleteBuilder.in).toHaveBeenCalledWith('team_id', ['team-1', 'team-2']);
    expect(checkinsDeleteBuilder.lt).toHaveBeenCalledWith('week_start', expect.any(String));
  });

  it('no llama a Storage si ningún checkin a purgar tiene audio', async () => {
    const supabase = fakeSupabase([
      { data: [{ id: 'org-1', history_retention_months: 1 }], error: null },
      { data: [{ id: 'team-1' }], error: null },
      { data: [{ audio_paths: [] }], error: null }, // sin audios
      { data: null, error: null }, // delete checkins
      { data: null, error: null }, // delete reports (team)
      { data: null, error: null }, // delete reports (organization)
      { data: null, error: null }, // delete survey_responses
      { data: null, error: null }, // delete survey_submissions
    ]);
    const audio = fakeAudio();
    const job = new RetentionJob(supabase, audio);

    await job.run();

    expect(audio.remove).not.toHaveBeenCalled();
  });

  it('salta el borrado de checkins/informes de equipo si la organización no tiene equipos', async () => {
    const supabase = fakeSupabase([
      { data: [{ id: 'org-1', history_retention_months: 6 }], error: null },
      { data: [], error: null }, // sin equipos
      { data: null, error: null }, // delete reports (organization)
      { data: null, error: null }, // delete survey_responses
      { data: null, error: null }, // delete survey_submissions
    ]);
    const audio = fakeAudio();
    const job = new RetentionJob(supabase, audio);

    await job.run();

    const calls = (supabase.db.from as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls).toEqual(['organizations', 'teams', 'reports', 'survey_responses', 'survey_submissions']);
    expect(audio.remove).not.toHaveBeenCalled();
  });

  it('un fallo en una organización no interrumpe el resto', async () => {
    const supabase = fakeSupabase([
      { data: [{ id: 'org-1', history_retention_months: 1 }, { id: 'org-2', history_retention_months: 1 }], error: null },
      { data: null, error: { message: 'boom' } }, // teams de org-1 falla
      { data: [], error: null }, // teams de org-2, sin equipos
      { data: null, error: null }, // delete reports (organization) de org-2
      { data: null, error: null }, // delete survey_responses de org-2
      { data: null, error: null }, // delete survey_submissions de org-2
    ]);
    const job = new RetentionJob(supabase, fakeAudio());

    await job.run();

    const calls = (supabase.db.from as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls).toEqual(['organizations', 'teams', 'teams', 'reports', 'survey_responses', 'survey_submissions']);
  });
});
