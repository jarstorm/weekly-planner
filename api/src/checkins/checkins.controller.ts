import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CheckinsService } from './checkins.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthedUser } from '../auth/auth.service';

@Controller('checkins')
@UseGuards(AuthGuard)
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Post('manual')
  saveManual(@CurrentUser() user: AuthedUser, @Body() dto: CreateCheckinDto) {
    return this.checkins.saveManual(user.organizationId, dto);
  }
}
