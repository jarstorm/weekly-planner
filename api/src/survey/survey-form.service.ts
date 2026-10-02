import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { signSurveyToken, verifySurveyToken } from './token.util';
import { SubmitSurveyFormDto } from './dto/submit-survey-form.dto';
import { AccountLanguage, localePrefix } from '../account-language';

export interface SurveyFormInfo {
  memberName: string;
  organizationName: string;
  questions: string[];
  alreadySubmitted: boolean;
}

@Injectable()
export class SurveyFormService {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  private secret(): string {
    const secret = this.config.get<string>('SURVEY_TOKEN_SECRET');
    if (!secret) throw new Error('SURVEY_TOKEN_SECRET no configurada');
    return secret;
  }

  buildLink(memberId: string, surveyId: string, language: AccountLanguage = 'es'): string {
    const token = signSurveyToken({ memberId, surveyId }, this.secret());
    const base = this.config.get<string>('APP_BASE_URL') ?? '';
    return `${base}${localePrefix(language)}/survey/${token}`;
  }

  private async resolveMember(token: string) {
    const decoded = verifySurveyToken(token, this.secret());
    if (!decoded) throw new NotFoundException('Enlace inválido');

    const { data: member, error } = await this.supabase.db
      .from('members')
      .select('id, name, team_id, teams(organization_id, organizations(id, name))')
      .eq('id', decoded.memberId)
      .maybeSingle();
    if (error) throw error;
    if (!member) throw new NotFoundException('Enlace inválido');

    const org = (member as any).teams?.organizations;
    if (!org) throw new NotFoundException('Enlace inválido');

    const { data: survey, error: surveyError } = await this.supabase.db
      .from('surveys')
      .select('id, organization_id, questions')
      .eq('id', decoded.surveyId)
      .maybeSingle();
    if (surveyError) throw surveyError;
    // El token lo firma siempre SurveyJob con el memberId/surveyId de la
    // misma organización — esta comprobación es defensiva, no debería
    // poder fallar con un token real, pero cierra la puerta a mezclar un
    // memberId de una organización con una surveyId de otra.
    if (!survey || survey.organization_id !== org.id) throw new NotFoundException('Enlace inválido');

    return { member, organization: org, survey };
  }

  async getForm(token: string): Promise<SurveyFormInfo> {
    const { member, organization, survey } = await this.resolveMember(token);

    const { data: existing, error } = await this.supabase.db
      .from('survey_submissions')
      .select('id')
      .eq('member_id', member.id)
      .eq('survey_id', survey.id)
      .maybeSingle();
    if (error) throw error;

    return {
      memberName: member.name,
      organizationName: organization.name,
      questions: survey.questions ?? [],
      alreadySubmitted: !!existing,
    };
  }

  async submit(dto: SubmitSurveyFormDto) {
    const { member, survey } = await this.resolveMember(dto.token);

    const questions: string[] = survey.questions ?? [];
    if (dto.answers.length !== questions.length) {
      throw new BadRequestException('El número de respuestas no coincide con el de preguntas');
    }

    // Se registra la participación ANTES de guardar el contenido, y con
    // un insert simple (no upsert): si ya existe una fila para este
    // member_id+survey_id, el unique constraint lo rechaza y no se llega
    // a guardar la respuesta — así nadie contesta dos veces la misma encuesta.
    const { error: submissionError } = await this.supabase.db
      .from('survey_submissions')
      .insert({ survey_id: survey.id, member_id: member.id });
    if (submissionError) {
      if ((submissionError as any).code === '23505') {
        throw new ForbiddenException('Ya has respondido esta encuesta');
      }
      throw submissionError;
    }

    // La fila de respuesta no lleva member_id ni team_id — nada la conecta
    // con la fila de survey_submissions de arriba más que haberse insertado
    // en la misma petición (no hay columna ni índice que las una).
    const { error: responseError } = await this.supabase.db.from('survey_responses').insert({
      survey_id: survey.id,
      questions,
      answers: dto.answers,
    });
    if (responseError) throw responseError;

    return { ok: true };
  }
}
