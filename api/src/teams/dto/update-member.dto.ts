import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['email', 'telegram'])
  channel?: 'email' | 'telegram';

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
