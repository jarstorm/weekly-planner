import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  name?: string;

  // Mover a otro equipo — tiene que ser de la MISMA organización (se valida
  // en TeamsService.updateMember, igual que el equipo actual) y respetar
  // max_members_per_team del equipo de destino.
  @IsOptional()
  @IsUUID()
  team_id?: string;

  @IsOptional()
  @IsIn(['email', 'whatsapp', 'telegram'])
  channel?: 'email' | 'whatsapp' | 'telegram';

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
