import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthedUser } from '../auth/auth.service';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { ApplyPromoCodeDto } from './dto/apply-promo-code.dto';

@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('status')
  status(@CurrentUser() user: AuthedUser) {
    return this.billing.getStatus(user.organizationId);
  }

  @Post('checkout')
  checkout(@CurrentUser() user: AuthedUser, @Body() dto: CreateCheckoutDto) {
    return this.billing.createCheckoutSession(user.organizationId, user.email, dto.plan);
  }

  @Post('portal')
  portal(@CurrentUser() user: AuthedUser) {
    return this.billing.createPortalSession(user.organizationId);
  }

  @Post('promo-code')
  applyPromoCode(@CurrentUser() user: AuthedUser, @Body() dto: ApplyPromoCodeDto) {
    return this.billing.applyPromoCode(user.organizationId, dto.code);
  }
}
