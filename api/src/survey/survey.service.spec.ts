import { SupabaseService } from '../supabase/supabase.service';
import { SurveyService } from './survey.service';

function fakeSupabase(responses: Array<{ data?: any; error?: any; count?: any }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      order: jest.fn(() => builder),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

describe('SurveyService.listPeriods', () => {
  it('deduplica periodos repetidos, manteniendo el orden más reciente primero', async () => {
    const supabase = fakeSupabase([{ data: [{ period: '2026-02-01' }, { period: '2026-01-01' }, { period: '2026-01-01' }], error: null }]);
    const service = new SurveyService(supabase);

    expect(await service.listPeriods('org-1')).toEqual(['2026-02-01', '2026-01-01']);
  });

  it('sin respuestas todavía, devuelve lista vacía', async () => {
    const supabase = fakeSupabase([{ data: [], error: null }]);
    const service = new SurveyService(supabase);

    expect(await service.listPeriods('org-1')).toEqual([]);
  });
});

describe('SurveyService.getResults', () => {
  it('agrupa las respuestas por pregunta, descartando vacíos/null, nunca por persona', async () => {
    const supabase = fakeSupabase([
      {
        data: [
          { questions: ['¿Qué tal el mes?', '¿Algo que mejorar?'], answers: ['Bien', ''] },
          { questions: ['¿Qué tal el mes?', '¿Algo que mejorar?'], answers: ['Regular', 'Más comunicación'] },
          { questions: ['¿Qué tal el mes?', '¿Algo que mejorar?'], answers: [null, 'Nada'] },
        ],
        error: null,
      }, // survey_responses
      { count: 2, error: null }, // survey_submissions
      { data: [{ id: 'team-1' }], error: null }, // teams
      { count: 3, error: null }, // members activos
    ]);
    const service = new SurveyService(supabase);

    const result = await service.getResults('org-1', '2026-01-01');

    expect(result).toEqual({
      period: '2026-01-01',
      questions: ['¿Qué tal el mes?', '¿Algo que mejorar?'],
      answersByQuestion: [['Bien', 'Regular'], ['Más comunicación', 'Nada']],
      responseCount: 3,
      submittedCount: 2,
      totalActiveMembers: 3,
    });
  });

  it('sin ninguna respuesta ese periodo, devuelve preguntas vacías y contadores en 0', async () => {
    const supabase = fakeSupabase([
      { data: [], error: null }, // survey_responses
      { count: 0, error: null }, // survey_submissions
      { data: [], error: null }, // teams -> sin equipos, countActiveMembers corta corto
    ]);
    const service = new SurveyService(supabase);

    const result = await service.getResults('org-1', '2026-03-01');

    expect(result).toEqual({
      period: '2026-03-01',
      questions: [],
      answersByQuestion: [],
      responseCount: 0,
      submittedCount: 0,
      totalActiveMembers: 0,
    });
  });
});
