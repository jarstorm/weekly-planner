import { IsString, MinLength } from 'class-validator';

export class ApplyPromoCodeDto {
  @IsString()
  @MinLength(1)
  code: string;
}
