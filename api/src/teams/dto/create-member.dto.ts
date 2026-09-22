import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  name: string;

  @IsIn(['email', 'telegram'])
  channel: 'email' | 'telegram';

  @IsString()
  contact: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
