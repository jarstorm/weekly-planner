import { BadRequestException } from '@nestjs/common';
import { SurveyService } from './survey.service';
import { SurveyController } from './survey.controller';

function fakeSurvey(): SurveyService {
  return {
    getResults: jest.fn(),
  } as unknown as SurveyService;
}

const user = { userId: 'u-1', email: 'a@b.com', organizationId: 'org-1' };

describe('SurveyController.getResults', () => {
  it('sin surveyId: 400 explícito, nunca llega a SurveyService (evita el 500 crudo de Postgres con "undefined")', () => {
    const survey = fakeSurvey();
    const controller = new SurveyController(survey);

    expect(() => controller.getResults(user, undefined)).toThrow(BadRequestException);
    expect(survey.getResults).not.toHaveBeenCalled();
  });

  it('con surveyId: delega en SurveyService con la organización de la sesión', () => {
    const survey = fakeSurvey();
    (survey.getResults as jest.Mock).mockResolvedValue({ surveyId: 'survey-1' });
    const controller = new SurveyController(survey);

    controller.getResults(user, 'survey-1');

    expect(survey.getResults).toHaveBeenCalledWith('org-1', 'survey-1');
  });
});
