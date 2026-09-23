import { IsOptional, IsString, Length, MinLength } from 'class-validator';

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
}
