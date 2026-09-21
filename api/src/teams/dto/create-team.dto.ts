import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  company_context?: string;

  @IsOptional()
  @IsIn(['email', 'whatsapp'])
  delivery_channel?: 'email' | 'whatsapp';

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
