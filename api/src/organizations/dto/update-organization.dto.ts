import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // ISO 3166-1 alpha-2 ('ES', 'US', ...) — se valida el largo, no la lista
  // completa de países válidos (criterio laxo deliberado).
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsString()
  contact_name?: string;

  // Configuración del "loop de feedback" — global para toda la cuenta
  // (migración 0006), no por equipo: mismo horario para todos los equipos
  // (el destino de cada informe pasó a ser una lista por equipo, ver
  // CreateTeamDto/UpdateTeamDto.report_recipients y migración 0009).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  reminder_dow?: number;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  reminder_time?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  cutoff_time?: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  // Idioma de la cuenta — preguntas del check-in, encuesta mensual e
  // informes con IA. No controla el idioma de la interfaz del panel
  // (eso sigue siendo el selector de next-intl, por navegador).
  @IsOptional()
  @IsIn(['es', 'en'])
  language?: 'es' | 'en';

  // Resumen ejecutivo (paso 15, sección 6.4 del doc de producto) — opción,
  // no forzada por plan; el constraint org_exec_summary_plan_check en
  // schema.sql rechaza activarlo fuera de Plan Organización/Custom.
  @IsOptional()
  @IsBoolean()
  has_executive_summary?: boolean;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  executive_summary_recipients?: string[];

  // Encuesta mensual anónima — opción, no forzada por plan; el constraint
  // org_survey_plan_check en schema.sql rechaza activarla fuera de Plan
  // Organización/Custom (mismo criterio que has_executive_summary).
  @IsOptional()
  @IsBoolean()
  has_monthly_survey?: boolean;

  // Máximo 5 preguntas (org_survey_questions_max en schema.sql lo rechaza
  // igual a nivel de base de datos) — de cuenta, no por equipo.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  survey_questions?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  survey_day_of_month?: number;
}
