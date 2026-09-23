import { IsBoolean, IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['email', 'telegram'])
  channel?: 'email' | 'telegram';

  // Igual que en el alta: para telegram esto lo rellena el bot al vincular,
  // no se edita a mano.
  @ValidateIf((o) => o.channel === 'email')
  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
