import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  company_context?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  report_recipients?: string[];
}
