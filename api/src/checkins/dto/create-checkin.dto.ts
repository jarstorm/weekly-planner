import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCheckinDto {
  @IsUUID()
  team_id: string;

  @IsUUID()
  member_id: string;

  @IsDateString()
  week_start: string; // lunes de la semana, YYYY-MM-DD

  @IsOptional()
  @IsString()
  raw_text?: string;

  @IsOptional()
  @IsString()
  done_text?: string;

  @IsOptional()
  @IsString()
  next_text?: string;

  @IsOptional()
  @IsString()
  blocker_text?: string;

  @IsOptional()
  @IsString()
  audio_path?: string; // path en el bucket privado "checkin-audio", si vino por nota de voz
}
