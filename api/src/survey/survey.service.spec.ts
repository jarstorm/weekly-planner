import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SurveyService } from './survey.service';

const NOW = new Date('2026-01-05T10:00:00Z');

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

function fakeSupabase(responses: Array<{ data?: any; error?: any; count?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      is: jest.fn(() => builder),
      not: jest.fn(() => builder),
      order: jest.fn(() => builder),
      insert: jest.fn(() => builder),
      single: jest.fn(() => Promise.resolve(result)),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

describe('SurveyService.createSurvey', () => {
  const input = { questions: ['¿Qué tal?'], scheduledDate: '2026-01-06', scheduledTime: '10:00', timezone: 'UTC' };

  it('rechaza fuera de Plan Organización/Custom', async () => {
    const supabase = fakeSupabase([{ data: { plan: 'equipo' }, error: null }]);
    const service = new SurveyService(supabase);

    await expect(service.createSurvey('org-1', input)).rejects.toThrow(ForbiddenException);
  });

  it('rechaza una fecha ya pasada', async () => {
    const supabase = fakeSupabase([{ data: { plan: 'organizacion' }, error: null }]);
    const service = new SurveyService(supabase);

    await expect(service.createSurvey('org-1', { ...input, scheduledDate: '2026-01-04' })).rejects.toThrow(
      'La fecha y hora de la encuesta tienen que ser futuras',
    );
  });

  it('rechaza una hora ya pasada el mismo día', async () => {
    const supabase = fakeSupabase([{ data: { plan: 'organizacion' }, error: null }]);
    const service = new SurveyService(supabase);

    await expect(service.createSurvey('org-1', { ...input, scheduledDate: '2026-01-05', scheduledTime: '09:00' })).rejects.toThrow(
      'La fecha y hora de la encuesta tienen que ser futuras',
    );
  });

  it('crea la encuesta con plan válido y fecha futura', async () => {
    const supabase = fakeSupabase([
      { data: { plan: 'organizacion' }, error: null }, // organizations
      {
        data: { id: 'survey-1', questions: input.questions, scheduled_date: input.scheduledDate, scheduled_time: input.scheduledTime, timezone: input.timezone },
        error: null,
      }, // insert surveys
    ]);
    const service = new SurveyService(supabase);

    const result = await service.createSurvey('org-1', input);

    expect(result).toEqual({ id: 'survey-1', questions: input.questions, scheduledDate: input.scheduledDate, scheduledTime: input.scheduledTime, timezone: input.timezone });
  });

  it('si ya hay una encuesta pendiente (unique constraint), da un 409 claro', async () => {
    const supabase = fakeSupabase([
      { data: { plan: 'custom' }, error: null },
      { data: null, error: { code: '23505' } },
    ]);
    const service = new SurveyService(supabase);

    await expect(service.createSurvey('org-1', input)).rejects.toThrow(ConflictException);
  });
});

describe('SurveyService.getPendingSurvey', () => {
  it('devuelve null si no hay ninguna pendiente', async () => {
    const supabase = fakeSupabase([{ data: null, error: null }]);
    const service = new SurveyService(supabase);

    expect(await service.getPendingSurvey('org-1')).toBeNull();
  });

  it('devuelve la encuesta pendiente con los campos en camelCase', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'survey-1', questions: ['¿Qué tal?'], scheduled_date: '2026-02-01', scheduled_time: '10:00', timezone: 'UTC' }, error: null },
    ]);
    const service = new SurveyService(supabase);

    expect(await service.getPendingSurvey('org-1')).toEqual({
      id: 'survey-1',
      questions: ['¿Qué tal?'],
      scheduledDate: '2026-02-01',
      scheduledTime: '10:00',
      timezone: 'UTC',
    });
  });
});

describe('SurveyService.listSurveys', () => {
  it('devuelve solo las ya enviadas, más reciente primero', async () => {
    const supabase = fakeSupabase([
      {
        data: [
          { id: 'survey-2', scheduled_date: '2026-02-01', sent_at: '2026-02-01T10:00:00Z' },
          { id: 'survey-1', scheduled_date: '2026-01-01', sent_at: '2026-01-01T10:00:00Z' },
        ],
        error: null,
      },
    ]);
    const service = new SurveyService(supabase);

    expect(await service.listSurveys('org-1')).toEqual([
      { id: 'survey-2', scheduledDate: '2026-02-01', sentAt: '2026-02-01T10:00:00Z' },
      { id: 'survey-1', scheduledDate: '2026-01-01', sentAt: '2026-01-01T10:00:00Z' },
    ]);
  });
});

describe('SurveyService.getResults', () => {
  it('lanza 404 si la encuesta no existe o no pertenece a la organización', async () => {
    const supabase = fakeSupabase([{ data: null, error: null }]);
    const service = new SurveyService(supabase);

    await expect(service.getResults('org-1', 'survey-ajena')).rejects.toThrow(NotFoundException);
  });

  it('no deja ver resultados de una encuesta de otra organización', async () => {
    const supabase = fakeSupabase([{ data: { id: 'survey-1', organization_id: 'org-ajena', questions: [], scheduled_date: '2026-01-01' }, error: null }]);
    const service = new SurveyService(supabase);

    await expect(service.getResults('org-1', 'survey-1')).rejects.toThrow(NotFoundException);
  });

  it('agrupa las respuestas por pregunta (de la encuesta, no de las respuestas), descartando vacíos/null', async () => {
    const supabase = fakeSupabase([
      {
        data: { id: 'survey-1', organization_id: 'org-1', questions: ['¿Qué tal el mes?', '¿Algo que mejorar?'], scheduled_date: '2026-01-05' },
        error: null,
      }, // surveys
      {
        data: [
          { answers: ['Bien', ''] },
          { answers: ['Regular', 'Más comunicación'] },
          { answers: [null, 'Nada'] },
        ],
        error: null,
      }, // survey_responses
      { count: 3, error: null }, // survey_submissions
      { data: [{ id: 'team-1' }], error: null }, // teams
      { count: 5, error: null }, // members activos
    ]);
    const service = new SurveyService(supabase);

    const result = await service.getResults('org-1', 'survey-1');

    expect(result).toEqual({
      surveyId: 'survey-1',
      scheduledDate: '2026-01-05',
      questions: ['¿Qué tal el mes?', '¿Algo que mejorar?'],
      answersByQuestion: [['Bien', 'Regular'], ['Más comunicación', 'Nada']],
      responseCount: 3,
      submittedCount: 3,
      totalActiveMembers: 5,
    });
  });

  it('muestra las preguntas de la encuesta aunque todavía no haya ninguna respuesta', async () => {
    const supabase = fakeSupabase([
      { data: { id: 'survey-1', organization_id: 'org-1', questions: ['¿Qué tal?'], scheduled_date: '2026-01-05' }, error: null },
      { data: [], error: null }, // survey_responses
      { count: 0, error: null }, // survey_submissions
      { data: [], error: null }, // teams -> sin equipos, countActiveMembers corta corto
    ]);
    const service = new SurveyService(supabase);

    const result = await service.getResults('org-1', 'survey-1');

    expect(result).toEqual({
      surveyId: 'survey-1',
      scheduledDate: '2026-01-05',
      questions: ['¿Qué tal?'],
      answersByQuestion: [[]],
      responseCount: 0,
      submittedCount: 0,
      totalActiveMembers: 0,
    });
  });
});
