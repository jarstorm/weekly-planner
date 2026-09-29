import { Body, Controller, Post } from '@nestjs/common';
import { MemberVerifyService } from './member-verify.service';
import { VerifyMemberEmailDto } from './dto/verify-member-email.dto';

// Sin AuthGuard, mismo criterio que checkin-form/survey-form: el token
// firmado en la URL es la credencial, el miembro no tiene cuenta.
@Controller('members/verify-email')
export class MemberVerifyController {
  constructor(private readonly memberVerify: MemberVerifyService) {}

  @Post()
  async verify(@Body() dto: VerifyMemberEmailDto) {
    await this.memberVerify.verify(dto.token);
    return { ok: true };
  }
}
