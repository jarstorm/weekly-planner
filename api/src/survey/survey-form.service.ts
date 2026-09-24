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

  buildLink(memberId: string, period: string, language: AccountLanguage = 'es'): string {
    const token = signSurveyToken({ memberId, period }, this.secret());
    const base = this.config.get<string>('APP_BASE_URL') ?? '';
    return `${base}${localePrefix(language)}/survey/${token}`;
  }

  private async resolveMember(token: string) {
    const decoded = verifySurveyToken(token, this.secret());
    if (!decoded) throw new NotFoundException('Enlace inválido');

    const { data: member, error } = await this.supabase.db
      .from('members')
      .select('id, name, team_id, teams(organization_id, organizations(id, name, has_monthly_survey, survey_questions))')
      .eq('id', decoded.memberId)
      .maybeSingle();
    if (error) throw error;
    if (!member) throw new NotFoundException('Enlace inválido');

    const org = (member as any).teams?.organizations;
    if (!org) throw new NotFoundException('Enlace inválido');

    return { member, organization: org, period: decoded.period };
  }

  async getForm(token: string): Promise<SurveyFormInfo> {
    const { member, organization, period } = await this.resolveMember(token);
    if (!organization.has_monthly_survey) {
      throw new NotFoundException('La encuesta mensual no está activa para esta cuenta');
    }

    const { data: existing, error } = await this.supabase.db
      .from('survey_submissions')
      .select('id')
      .eq('member_id', member.id)
      .eq('period', period)
      .maybeSingle();
    if (error) throw error;

    return {
      memberName: member.name,
      organizationName: organization.name,
      questions: organization.survey_questions ?? [],
      alreadySubmitted: !!existing,
    };
  }

  async submit(dto: SubmitSurveyFormDto) {
    const { member, organization, period } = await this.resolveMember(dto.token);
    if (!organization.has_monthly_survey) {
      throw new NotFoundException('La encuesta mensual no está activa para esta cuenta');
    }

    const questions: string[] = organization.survey_questions ?? [];
    if (dto.answers.length !== questions.length) {
      throw new BadRequestException('El número de respuestas no coincide con el de preguntas');
    }

    // Se registra la participación ANTES de guardar el contenido, y con
    // un insert simple (no upsert): si ya existe una fila para este
    // member_id+period, el unique constraint lo rechaza y no se llega a
    // guardar la respuesta — así nadie contesta dos veces el mismo mes.
    const { error: submissionError } = await this.supabase.db
      .from('survey_submissions')
      .insert({ organization_id: organization.id, member_id: member.id, period });
    if (submissionError) {
      if ((submissionError as any).code === '23505') {
        throw new ForbiddenException('Ya has respondido la encuesta de este mes');
      }
      throw submissionError;
    }

    // La fila de respuesta no lleva member_id ni team_id — nada la conecta
    // con la fila de survey_submissions de arriba más que haberse insertado
    // en la misma petición (no hay columna ni índice que las una).
    const { error: responseError } = await this.supabase.db.from('survey_responses').insert({
      organization_id: organization.id,
      period,
      questions,
      answers: dto.answers,
    });
    if (responseError) throw responseError;

    return { ok: true };
  }
}
