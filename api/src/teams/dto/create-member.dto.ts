import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  name: string;

  @IsIn(['email', 'whatsapp', 'telegram'])
  channel: 'email' | 'whatsapp' | 'telegram';

  @IsString()
  contact: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
