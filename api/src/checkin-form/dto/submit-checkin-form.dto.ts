import { IsOptional, IsString } from 'class-validator';

export class SubmitCheckinFormDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  doneText?: string;

  @IsOptional()
  @IsString()
  nextText?: string;

  @IsOptional()
  @IsString()
  blockerText?: string;
}
