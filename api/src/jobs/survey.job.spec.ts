import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { SurveyFormService } from '../survey/survey-form.service';
import { SurveyJob } from './survey.job';

// Lunes 2026-01-05 10:00 UTC — día del mes 5, mismo patrón que los otros jobs.
const NOW = new Date('2026-01-05T10:00:00Z');
const PERIOD = '2026-01-01';

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

function orgRow(overrides: Record<string, any> = {}) {
  return {
    id: 'org-1',
    name: 'Org',
    timezone: 'UTC',
    reminder_time: '10:00:00',
    survey_day_of_month: 5,
    survey_questions: ['¿Qué tal el mes?'],
    language: 'es',
    ...overrides,
  };
}

function fakeSupabase(responses: Array<{ data?: any; error?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

function fakeChannels() {
  const send = jest.fn().mockResolvedValue(undefined);
  const channels = { get: jest.fn(() => ({ send, sendDocument: jest.fn() })) } as unknown as ChannelsService;
  return { channels, send };
}

function fakeSurveyForm(): SurveyFormService {
  return { buildLink: jest.fn(() => 'https://weeklyfeedback.com/survey/tok') } as unknown as SurveyFormService;
}

describe('SurveyJob', () => {
  it('ignora organizaciones que no están en su día del mes', async () => {
    const supabase = fakeSupabase([{ data: [orgRow({ survey_day_of_month: 20 })], error: null }]);
    const { channels, send } = fakeChannels();
    const job = new SurveyJob(supabase, channels, fakeSurveyForm());

    await job.run();

    expect(send).not.toHaveBeenCalled();
    expect((supabase.db.from as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['organizations']);
  });

  it('ignora organizaciones sin preguntas configuradas', async () => {
    const supabase = fakeSupabase([{ data: [orgRow({ survey_questions: [] })], error: null }]);
    const { channels, send } = fakeChannels();
    const job = new SurveyJob(supabase, channels, fakeSurveyForm());

    await job.run();

    expect(send).not.toHaveBeenCalled();
  });

  it('no manda nada si la organización no tiene equipos', async () => {
    const supabase = fakeSupabase([
      { data: [orgRow()], error: null }, // organizations
      { data: [], error: null }, // teams -> ninguno
    ]);
    const { channels, send } = fakeChannels();
    const job = new SurveyJob(supabase, channels, fakeSurveyForm());

    await job.run();

    expect(send).not.toHaveBeenCalled();
  });

  it('manda el link de la encuesta a cada miembro activo que no haya respondido ya este período', async () => {
    const supabase = fakeSupabase([
      { data: [orgRow()], error: null }, // organizations
      { data: [{ id: 'team-1' }], error: null }, // teams
      {
        data: [
          { id: 'm-1', name: 'Ana', channel: 'email', contact: 'ana@example.com' },
          { id: 'm-2', name: 'Bruno', channel: 'email', contact: 'bruno@example.com' },
          { id: 'm-3', name: 'Sin vincular', channel: 'telegram', contact: null },
        ],
        error: null,
      }, // members activos
      { data: [{ member_id: 'm-2' }], error: null }, // Bruno ya respondió este período
    ]);
    const { channels, send } = fakeChannels();
    const surveyForm = fakeSurveyForm();
    const job = new SurveyJob(supabase, channels, surveyForm);

    await job.run();

    expect(surveyForm.buildLink).toHaveBeenCalledWith('m-1', PERIOD, 'es');
    expect(surveyForm.buildLink).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('ana@example.com', expect.stringContaining('https://weeklyfeedback.com/survey/tok'));
  });

  it('un fallo mandando a un miembro, o a una organización, no interrumpe el resto', async () => {
    const orgA = orgRow({ id: 'org-a' });
    const orgB = orgRow({ id: 'org-b' });
    const supabase = fakeSupabase([
      { data: [orgA, orgB], error: null }, // organizations
      { data: null, error: { message: 'boom' } }, // teams de org-a falla
      { data: [{ id: 'team-b' }], error: null }, // teams de org-b
      { data: [{ id: 'm-1', name: 'Carla', channel: 'email', contact: 'carla@example.com' }], error: null }, // members de org-b
      { data: [], error: null }, // survey_submissions de org-b
    ]);
    const send = jest.fn().mockResolvedValue(undefined);
    const channels = { get: jest.fn(() => ({ send, sendDocument: jest.fn() })) } as unknown as ChannelsService;
    const job = new SurveyJob(supabase, channels, fakeSurveyForm());

    await expect(job.run()).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledWith('carla@example.com', expect.any(String));
  });
});
