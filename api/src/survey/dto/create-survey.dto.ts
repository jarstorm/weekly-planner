import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches, IsTimeZone } from 'class-validator';

export class CreateSurveyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  questions: string[];

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  scheduledDate: string;

  @Matches(/^\d{2}:\d{2}$/)
  scheduledTime: string;

  @IsTimeZone()
  timezone: string;
}
