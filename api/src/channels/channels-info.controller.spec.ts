import { ConfigService } from '@nestjs/config';
import { ChannelsInfoController } from './channels-info.controller';

function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string, def?: string) => values[key] ?? def } as unknown as ConfigService;
}

describe('ChannelsInfoController.getEnabled', () => {
  it('email siempre true, sea lo que sea la config', () => {
    const controller = new ChannelsInfoController(fakeConfig({}));

    expect(controller.getEnabled().email).toBe(true);
  });

  it('sin ENABLE_TELEGRAM_CHANNEL configurada, telegram sale true por defecto', () => {
    const controller = new ChannelsInfoController(fakeConfig({}));

    expect(controller.getEnabled().telegram).toBe(true);
  });

  it('ENABLE_TELEGRAM_CHANNEL=false deshabilita telegram en toda la UI', () => {
    const controller = new ChannelsInfoController(fakeConfig({ ENABLE_TELEGRAM_CHANNEL: 'false' }));

    expect(controller.getEnabled().telegram).toBe(false);
  });

  it('sin ENABLE_WHATSAPP_CHANNEL configurada, whatsapp sale false por defecto (cuenta de Meta no siempre operativa)', () => {
    const controller = new ChannelsInfoController(fakeConfig({}));

    expect(controller.getEnabled().whatsapp).toBe(false);
  });

  it('ENABLE_WHATSAPP_CHANNEL=true habilita whatsapp', () => {
    const controller = new ChannelsInfoController(fakeConfig({ ENABLE_WHATSAPP_CHANNEL: 'true' }));

    expect(controller.getEnabled().whatsapp).toBe(true);
  });

  it('cualquier valor que no sea exactamente "true" deja whatsapp deshabilitado (ej. typo en el .env)', () => {
    const controller = new ChannelsInfoController(fakeConfig({ ENABLE_WHATSAPP_CHANNEL: 'True' }));

    expect(controller.getEnabled().whatsapp).toBe(false);
  });
});
