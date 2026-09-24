import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface SurveyResults {
  period: string;
  questions: string[];
  // answersByQuestion[i] = todas las respuestas recibidas para questions[i],
  // en el orden en que llegaron — sin nada que identifique quién la mandó.
  answersByQuestion: string[][];
  responseCount: number;
  submittedCount: number;
  totalActiveMembers: number;
}

@Injectable()
export class SurveyService {
  constructor(private readonly supabase: SupabaseService) {}

  // Meses (primer día de cada uno) con al menos una respuesta guardada,
  // más recientes primero — para el selector de periodo del panel.
  async listPeriods(organizationId: string): Promise<string[]> {
    const { data, error } = await this.supabase.db
      .from('survey_responses')
      .select('period')
      .eq('organization_id', organizationId)
      .order('period', { ascending: false });
    if (error) throw error;
    return Array.from(new Set((data ?? []).map((r: any) => r.period as string)));
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

  async getResults(organizationId: string, period: string): Promise<SurveyResults> {
    const { data: responses, error } = await this.supabase.db
      .from('survey_responses')
      .select('questions, answers')
      .eq('organization_id', organizationId)
      .eq('period', period);
    if (error) throw error;

    // Todas las respuestas de un mismo periodo comparten las mismas
    // preguntas (se copian de organizations.survey_questions al momento de
    // responder, y ese momento cae siempre dentro del mismo mes) — se toma
    // la primera fila como referencia de cabecera.
    const questions: string[] = responses?.[0]?.questions ?? [];
    const answersByQuestion: string[][] = questions.map((_, i) =>
      (responses ?? []).map((r: any) => r.answers[i]).filter((a: string) => a != null && a !== ''),
    );

    const { count: submittedCount, error: submittedError } = await this.supabase.db
      .from('survey_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('period', period);
    if (submittedError) throw submittedError;

    const totalActiveMembers = await this.countActiveMembers(organizationId);

    return {
      period,
      questions,
      answersByQuestion,
      responseCount: responses?.length ?? 0,
      submittedCount: submittedCount ?? 0,
      totalActiveMembers,
    };
  }
}
