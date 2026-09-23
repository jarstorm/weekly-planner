import { IsBoolean, IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  name: string;

  @IsIn(['email', 'whatsapp', 'telegram'])
  channel: 'email' | 'whatsapp' | 'telegram';

  // Para telegram no se pide: se rellena solo cuando la persona abre el
  // bot (deep link con su member.id como start param, ver webhooks.controller).
  @ValidateIf((o) => o.channel === 'email')
  @IsString()
  contact?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
