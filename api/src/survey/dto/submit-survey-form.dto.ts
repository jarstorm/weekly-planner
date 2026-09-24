import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class SubmitSurveyFormDto {
  @IsString()
  token: string;

  // Mismo orden que las preguntas devueltas por GET /survey/form?token=...
  // — el índice es lo único que asocia una respuesta a su pregunta, no hay
  // ids de pregunta (la lista de preguntas ni siquiera es una tabla propia).
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  answers: string[];
}
