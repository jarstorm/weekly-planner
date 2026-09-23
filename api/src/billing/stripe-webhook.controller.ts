import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';

// Sin AuthGuard — mismo patrón que los webhooks de WhatsApp/Telegram
// (api/src/webhooks/webhooks.controller.ts): la confianza viene de
// verificar la firma Stripe-Signature, no de una sesión de usuario.
// El body debe llegar como Buffer sin parsear — configurado en main.ts
// con express.raw() solo para esta ruta, antes del JSON parser global.
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post()
  async receive(@Req() req: Request, @Headers('stripe-signature') signature: string) {
    if (!signature || !Buffer.isBuffer(req.body)) {
      throw new BadRequestException('Payload de webhook inválido');
    }
    const event = this.billing.verifyWebhookEvent(req.body, signature);
    await this.billing.handleEvent(event);
    return { received: true };
  }
}
