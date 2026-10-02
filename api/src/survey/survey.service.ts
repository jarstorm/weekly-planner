import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { dateInTimezone } from '../jobs/date.utils';

export interface PendingSurvey {
  id: string;
  questions: string[];
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
}

export interface SurveyListItem {
  id: string;
  scheduledDate: string;
  sentAt: string;
}

export interface SurveyResults {
  surveyId: string;
  scheduledDate: string;
  questions: string[];
  // answersByQuestion[i] = todas las respuestas recibidas para questions[i],
  // en el orden en que llegaron — sin nada que identifique quién la mandó.
  answersByQuestion: string[][];
  responseCount: number;
  submittedCount: number;
  totalActiveMembers: number;
}

export interface CreateSurveyInput {
  questions: string[];
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
}

@Injectable()
export class SurveyService {
  constructor(private readonly supabase: SupabaseService) {}

  // Disponibilidad por plan — antes era org_survey_plan_check (constraint
  // de organizations); con la encuesta en su propia tabla, no hay forma
  // limpia de expresar "el plan de la organización referenciada" como
  // check constraint de otra tabla sin un trigger, así que se comprueba
  // acá (mismo criterio que el resto de reglas de plan, ver TeamsService).
  async createSurvey(organizationId: string, input: CreateSurveyInput): Promise<PendingSurvey> {
    const { data: org, error: orgError } = await this.supabase.db
      .from('organizations')
      .select('plan')
      .eq('id', organizationId)
      .single();
    if (orgError) throw orgError;
    if (org.plan !== 'organizacion' && org.plan !== 'custom') {
      throw new ForbiddenException('La encuesta anónima solo está disponible en Plan Organización/Custom');
    }

    // Sin fecha pasada: una encuesta cuya fecha+hora ya pasaron se quedaría
    // pendiente para siempre (SurveyJob solo la manda ese día concreto o,
    // si el cron estuvo caído, en cuanto detecta que ya tocaba — ver
    // jobs/survey.job.ts) y, al no haber función de cancelar, bloquearía
    // crear cualquier encuesta nueva (solo una pendiente a la vez).
    const now = new Date();
    const today = dateInTimezone(now, input.timezone);
    const nowTime = new Intl.DateTimeFormat('en-GB', { timeZone: input.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
      now,
    );
    if (input.scheduledDate < today || (input.scheduledDate === today && input.scheduledTime <= nowTime)) {
      throw new ForbiddenException('La fecha y hora de la encuesta tienen que ser futuras');
    }

    const { data, error } = await this.supabase.db
      .from('surveys')
      .insert({
        organization_id: organizationId,
        questions: input.questions,
        scheduled_date: input.scheduledDate,
        scheduled_time: input.scheduledTime,
        timezone: input.timezone,
      })
      .select('id, questions, scheduled_date, scheduled_time, timezone')
      .single();
    if (error) {
      // surveys_one_pending_per_org — ya hay una encuesta sin mandar.
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Ya hay una encuesta pendiente de mandar — espera a que se envíe antes de crear otra');
      }
      throw error;
    }
    return this.toPendingSurvey(data);
  }

  async getPendingSurvey(organizationId: string): Promise<PendingSurvey | null> {
    const { data, error } = await this.supabase.db
      .from('surveys')
      .select('id, questions, scheduled_date, scheduled_time, timezone')
      .eq('organization_id', organizationId)
      .is('sent_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? this.toPendingSurvey(data) : null;
  }

  // Histórico de encuestas ya enviadas, más reciente primero — para el
  // selector de resultados del panel.
  async listSurveys(organizationId: string): Promise<SurveyListItem[]> {
    const { data, error } = await this.supabase.db
      .from('surveys')
      .select('id, scheduled_date, sent_at')
      .eq('organization_id', organizationId)
      .not('sent_at', 'is', null)
      .order('scheduled_date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((s: any) => ({ id: s.id, scheduledDate: s.scheduled_date, sentAt: s.sent_at }));
  }

  private async countActiveMembers(organizationId: string): Promise<number> {
    const { data: teams, error: teamsError } = await this.supabase.db
      .from('teams')
      .select('id')
      .eq('organization_id', organizationId);
    if (teamsError) throw teamsError;
    const teamIds = (teams ?? []).map((t: any) => t.id);
    if (teamIds.length === 0) return 0;

    const { count, error } = await this.supabase.db
      .from('members')
      .select('id', { count: 'exact', head: true })
      .in('team_id', teamIds)
      .eq('active', true);
    if (error) throw error;
    return count ?? 0;
  }

  async getResults(organizationId: string, surveyId: string): Promise<SurveyResults> {
    const { data: survey, error: surveyError } = await this.supabase.db
      .from('surveys')
      .select('id, organization_id, questions, scheduled_date')
      .eq('id', surveyId)
      .maybeSingle();
    if (surveyError) throw surveyError;
    if (!survey || survey.organization_id !== organizationId) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    const { data: responses, error } = await this.supabase.db.from('survey_responses').select('answers').eq('survey_id', surveyId);
    if (error) throw error;

    const questions: string[] = survey.questions ?? [];
    const answersByQuestion: string[][] = questions.map((_, i) =>
      (responses ?? []).map((r: any) => r.answers[i]).filter((a: string) => a != null && a !== ''),
    );

    const { count: submittedCount, error: submittedError } = await this.supabase.db
      .from('survey_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('survey_id', surveyId);
    if (submittedError) throw submittedError;

    const totalActiveMembers = await this.countActiveMembers(organizationId);

    return {
      surveyId,
      scheduledDate: survey.scheduled_date,
      questions,
      answersByQuestion,
      responseCount: responses?.length ?? 0,
      submittedCount: submittedCount ?? 0,
      totalActiveMembers,
    };
  }

  private toPendingSurvey(row: any): PendingSurvey {
    return {
      id: row.id,
      questions: row.questions ?? [],
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time,
      timezone: row.timezone,
    };
  }
}
