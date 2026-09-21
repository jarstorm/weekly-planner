import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  name: string;

  @IsIn(['email', 'whatsapp'])
  channel: 'email' | 'whatsapp';

  @IsString()
  contact: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
