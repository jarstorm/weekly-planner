import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min, MinLength } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // ISO 3166-1 alpha-2 ('ES', 'US', ...) — se valida el largo, no la lista
  // completa de países válidos (mismo criterio laxo que delivery_channel
  // antes de sus constraints de base de datos).
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsString()
  contact_name?: string;

  // Configuración del "loop de feedback" — global para toda la cuenta
  // (migración 0006), no por equipo: mismo horario y mismo destino de
  // entrega para todos los equipos.
  @IsOptional()
  @IsIn(['email', 'telegram'])
  delivery_channel?: 'email' | 'telegram';

  @IsOptional()
  @IsString()
  delivery_target?: string;

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
  @IsString()
  timezone?: string;
}
