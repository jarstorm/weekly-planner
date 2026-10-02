import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { StripeWebhookController } from './stripe-webhook.controller';

function fakeBilling(event: any = { type: 'checkout.session.completed' }) {
  return {
    verifyWebhookEvent: jest.fn().mockReturnValue(event),
    handleEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as BillingService;
}

function fakeRequest(body: any): Request {
  return { body } as unknown as Request;
}

describe('StripeWebhookController', () => {
  it('rechaza con 400 sin verificar nada si falta la cabecera Stripe-Signature', async () => {
    const billing = fakeBilling();
    const controller = new StripeWebhookController(billing);

    await expect(controller.receive(fakeRequest(Buffer.from('{}')), '')).rejects.toThrow(BadRequestException);
    expect(billing.verifyWebhookEvent).not.toHaveBeenCalled();
    expect(billing.handleEvent).not.toHaveBeenCalled();
  });

  it('rechaza con 400 si el body no llegó como Buffer sin parsear (express.raw mal montado para esta ruta)', async () => {
    const billing = fakeBilling();
    const controller = new StripeWebhookController(billing);

    await expect(controller.receive(fakeRequest({ already: 'parsed as json' }), 'sig_123')).rejects.toThrow(BadRequestException);
    expect(billing.verifyWebhookEvent).not.toHaveBeenCalled();
  });

  it('con firma y body en Buffer, verifica el evento y lo procesa, sin tragarse un fallo de verificación', async () => {
    const event = { type: 'customer.subscription.deleted' };
    const billing = fakeBilling(event);
    const controller = new StripeWebhookController(billing);
    const rawBody = Buffer.from('{"type":"customer.subscription.deleted"}');

    const result = await controller.receive(fakeRequest(rawBody), 'sig_123');

    expect(billing.verifyWebhookEvent).toHaveBeenCalledWith(rawBody, 'sig_123');
    expect(billing.handleEvent).toHaveBeenCalledWith(event);
    expect(result).toEqual({ received: true });
  });

  it('una firma inválida (verifyWebhookEvent lanza) nunca llega a handleEvent', async () => {
    const billing = {
      verifyWebhookEvent: jest.fn(() => {
        throw new Error('Webhook signature verification failed');
      }),
      handleEvent: jest.fn(),
    } as unknown as BillingService;
    const controller = new StripeWebhookController(billing);

    await expect(controller.receive(fakeRequest(Buffer.from('{}')), 'sig_falsa')).rejects.toThrow('Webhook signature verification failed');
    expect(billing.handleEvent).not.toHaveBeenCalled();
  });
});
