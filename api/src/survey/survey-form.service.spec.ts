import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { SurveyFormService } from './survey-form.service';
import { signSurveyToken } from './token.util';

const SECRET = 'test-secret';

// Mismo patrón de cola de respuestas que teams.service.spec.ts.
function fakeSupabase(responses: Array<{ data?: any; error?: any; count?: number }>): SupabaseService {
  let i = 0;
  const from = jest.fn(() => {
    const result = responses[i++];
    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      insert: jest.fn(() => builder),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { db: { from } } as unknown as SupabaseService;
}

function fakeConfig(): ConfigService {
  return {
    get: (key: string) => (key === 'SURVEY_TOKEN_SECRET' ? SECRET : 'http://app.test'),
  } as unknown as ConfigService;
}

const org = { id: 'org-1', name: 'Acme' };

const memberRow = {
  id: 'member-1',
  name: 'Ana',
  team_id: 'team-1',
  teams: { organization_id: 'org-1', organizations: org },
};

const surveyRow = {
  id: 'survey-1',
  organization_id: 'org-1',
  questions: ['¿Cómo te sientes con la carga de trabajo?', '¿Algo que el equipo debería saber?'],
};

function tokenFor(surveyId = 'survey-1') {
  return signSurveyToken({ memberId: 'member-1', surveyId }, SECRET);
}

describe('SurveyFormService', () => {
  it('getForm devuelve las preguntas de la encuesta y si ya respondió', async () => {
    const supabase = fakeSupabase([
      { data: memberRow, error: null }, // resolveMember: member
      { data: surveyRow, error: null }, // resolveMember: survey
      { data: null, error: null }, // survey_submissions lookup — no respondió
    ]);
    const service = new SurveyFormService(fakeConfig(), supabase);

    const form = await service.getForm(tokenFor());
    expect(form).toEqual({
      memberName: 'Ana',
      organizationName: 'Acme',
      questions: surveyRow.questions,
      alreadySubmitted: false,
    });
  });

  it('rechaza un token inválido', async () => {
    const service = new SurveyFormService(fakeConfig(), fakeSupabase([]));
    await expect(service.getForm('token-basura')).rejects.toThrow(NotFoundException);
  });

  it('rechaza si la encuesta del token no pertenece a la organización del member (defensivo)', async () => {
    const supabase = fakeSupabase([
      { data: memberRow, error: null },
      { data: { ...surveyRow, organization_id: 'org-ajena' }, error: null },
    ]);
    const service = new SurveyFormService(fakeConfig(), supabase);

    await expect(service.getForm(tokenFor())).rejects.toThrow(NotFoundException);
  });

  it('rechaza si el número de respuestas no coincide con el de preguntas', async () => {
    const supabase = fakeSupabase([
      { data: memberRow, error: null },
      { data: surveyRow, error: null },
    ]);
    const service = new SurveyFormService(fakeConfig(), supabase);

    await expect(service.submit({ token: tokenFor(), answers: ['solo una'] })).rejects.toThrow(BadRequestException);
  });

  it('guarda la respuesta sin member_id/team_id y marca la participación', async () => {
    const supabase = fakeSupabase([
      { data: memberRow, error: null }, // resolveMember: member
      { data: surveyRow, error: null }, // resolveMember: survey
      { data: null, error: null }, // insert survey_submissions
      { data: null, error: null }, // insert survey_responses
    ]);
    const service = new SurveyFormService(fakeConfig(), supabase);

    await expect(service.submit({ token: tokenFor(), answers: ['bien', 'nada en particular'] })).resolves.toEqual({ ok: true });

    // insert de survey_responses no debe llevar member_id ni team_id —
    // solo survey_id, preguntas y respuestas.
    const insertCalls = (supabase.db.from as jest.Mock).mock.results;
    const submissionsBuilder = insertCalls[2].value;
    const responsesBuilder = insertCalls[3].value;
    expect(submissionsBuilder.insert).toHaveBeenCalledWith({ survey_id: 'survey-1', member_id: 'member-1' });
    const insertedPayload = responsesBuilder.insert.mock.calls[0][0];
    expect(insertedPayload).not.toHaveProperty('member_id');
    expect(insertedPayload).not.toHaveProperty('team_id');
    expect(insertedPayload.survey_id).toBe('survey-1');
  });

  it('rechaza responder dos veces la misma encuesta (unique constraint en survey_submissions)', async () => {
    const supabase = fakeSupabase([
      { data: memberRow, error: null },
      { data: surveyRow, error: null },
      { data: null, error: { code: '23505' } }, // insert survey_submissions choca con el unique
    ]);
    const service = new SurveyFormService(fakeConfig(), supabase);

    await expect(service.submit({ token: tokenFor(), answers: ['bien', 'nada'] })).rejects.toThrow(ForbiddenException);
  });
});
