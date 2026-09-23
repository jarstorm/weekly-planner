import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  company_context?: string;

  // Emails que reciben el informe semanal de ESTE equipo (migración 0009)
  // — siempre email, sin selector de canal por destinatario.
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  report_recipients?: string[];
}
