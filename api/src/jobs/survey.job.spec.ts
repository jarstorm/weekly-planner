import { SupabaseService } from '../supabase/supabase.service';
import { ChannelsService } from '../channels/channels.service';
import { SurveyFormService } from '../survey/survey-form.service';
import { SurveyJob } from './survey.job';

// Lunes 2026-01-05 10:00 UTC, mismo patrón que los otros jobs.
const NOW = new Date('2026-01-05T10:00:00Z');

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

function surveyRow(overrides: Record<string, any> = {}) {
  return {
    id: 'survey-1',
    organization_id: 'org-1',
    questions: ['¿Qué tal?'],
    scheduled_date: '2026-01-05',
    scheduled_time: '10:00',
    timezone: 'UTC',
    organizations: { name: 'Org', language: 'es' },
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
      is: jest.fn(() => builder),
      update: jest.fn(() => builder),
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

function fakeSurveyForm(): { surveyForm: SurveyFormService; buildLink: jest.Mock } {
  const buildLink = jest.fn(() => 'https://weeklyfeedback.com/survey/tok');
  return { surveyForm: { buildLink } as unknown as SurveyFormService, buildLink };
}

describe('SurveyJob', () => {
  it('sin ninguna encuesta pendiente de mandar, no hace nada más', async () => {
    const supabase = fakeSupabase([{ data: [], error: null }]);
    const { channels, send } = fakeChannels();
    const job = new SurveyJob(supabase, channels, fakeSurveyForm().surveyForm);

    await job.run();

    expect(send).not.toHaveBeenCalled();
    expect((supabase.db.from as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['surveys']);
  });

  it('ignora una encuesta programada para una fecha futura', async () => {
    const supabase = fakeSupabase([{ data: [surveyRow({ scheduled_date: '2026-01-06' })], error: null }]);
    const { channels, send } = fakeChannels();
    const job = new SurveyJob(supabase, channels, fakeSurveyForm().surveyForm);

    await job.run();

    expect(send).not.toHaveBeenCalled();
  });

  it('el mismo día, fuera de la ventana de 15 min de la hora elegida, todavía no la manda', async () => {
    const supabase = fakeSupabase([{ data: [surveyRow({ scheduled_time: '18:00' })], error: null }]);
    const { channels, send } = fakeChannels();
    const job = new SurveyJob(supabase, channels, fakeSurveyForm().surveyForm);

    await job.run();

    expect(send).not.toHaveBeenCalled();
  });

  it('el mismo día, dentro de la ventana: manda a cada miembro activo con contacto y marca sent_at', async () => {
    const supabase = fakeSupabase([
      { data: [surveyRow()], error: null }, // surveys
      { data: [{ id: 'team-1' }], error: null }, // teams
      {
        data: [
          { id: 'm-1', name: 'Ana', channel: 'email', contact: 'ana@example.com' },
          { id: 'm-2', name: 'Sin vincular', channel: 'telegram', contact: null },
        ],
        error: null,
      }, // members activos
      { data: null, error: null }, // update sent_at
    ]);
    const { channels, send } = fakeChannels();
    const { surveyForm, buildLink } = fakeSurveyForm();
    const job = new SurveyJob(supabase, channels, surveyForm);

    await job.run();

    expect(buildLink).toHaveBeenCalledWith('m-1', 'survey-1', 'es');
    expect(buildLink).toHaveBeenCalledTimes(1); // nunca para el miembro sin contacto (telegram sin vincular)
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('ana@example.com', expect.stringContaining('https://weeklyfeedback.com/survey/tok'));

    const updateBuilder = (supabase.db.from as jest.Mock).mock.results[3].value;
    expect(updateBuilder.update).toHaveBeenCalledWith({ sent_at: expect.any(String) });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'survey-1');
    expect(updateBuilder.is).toHaveBeenCalledWith('sent_at', null);
  });

  it('una encuesta con la fecha ya pasada (cron caído) se manda igual, sin esperar a la ventana de hora', async () => {
    const supabase = fakeSupabase([
      { data: [surveyRow({ scheduled_date: '2026-01-01', scheduled_time: '18:00' })], error: null },
      { data: [], error: null }, // teams -> ninguno, no hace falta mandar a nadie
      { data: null, error: null }, // update sent_at igual se marca
    ]);
    const { channels, send } = fakeChannels();
    const job = new SurveyJob(supabase, channels, fakeSurveyForm().surveyForm);

    await job.run();

    const updateBuilder = (supabase.db.from as jest.Mock).mock.results[2].value;
    expect(updateBuilder.update).toHaveBeenCalledWith({ sent_at: expect.any(String) });
  });

  it('organización sin equipos: no manda nada a nadie, pero igual marca la encuesta como enviada', async () => {
    const supabase = fakeSupabase([
      { data: [surveyRow()], error: null },
      { data: [], error: null }, // teams -> ninguno
      { data: null, error: null }, // update sent_at
    ]);
    const { channels, send } = fakeChannels();
    const job = new SurveyJob(supabase, channels, fakeSurveyForm().surveyForm);

    await job.run();

    expect(send).not.toHaveBeenCalled();
    const updateBuilder = (supabase.db.from as jest.Mock).mock.results[2].value;
    expect(updateBuilder.update).toHaveBeenCalledWith({ sent_at: expect.any(String) });
  });

  it('un fallo mandando a un miembro, o procesando una encuesta, no interrumpe el resto', async () => {
    const surveyA = surveyRow({ id: 'survey-a', organization_id: 'org-a' });
    const surveyB = surveyRow({ id: 'survey-b', organization_id: 'org-b' });
    const supabase = fakeSupabase([
      { data: [surveyA, surveyB], error: null }, // surveys
      { data: null, error: { message: 'boom' } }, // teams de survey-a falla
      { data: [{ id: 'team-b' }], error: null }, // teams de survey-b
      { data: [{ id: 'm-1', name: 'Carla', channel: 'email', contact: 'carla@example.com' }], error: null }, // members de survey-b
      { data: null, error: null }, // update sent_at de survey-b
    ]);
    const { channels, send } = fakeChannels();
    const job = new SurveyJob(supabase, channels, fakeSurveyForm().surveyForm);

    await expect(job.run()).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledWith('carla@example.com', expect.any(String));
  });
});
