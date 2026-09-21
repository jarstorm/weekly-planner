import { IsIn } from 'class-validator';

export class CreateCheckoutDto {
  @IsIn(['equipo', 'organizacion'])
  plan: 'equipo' | 'organizacion';
}
