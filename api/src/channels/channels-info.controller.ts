import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Público, sin AuthGuard — lo consultan los <select> de canal (onboarding,
// members/new, members/[memberId]/edit) para saber qué opciones mostrar
// además de email (fijo siempre). Permite activar/desactivar
// Telegram o WhatsApp como opción visible con una env var, sin tocar
// código, según si la cuenta/bot correspondiente está operativa (ver
// docs/especificaciones-tecnicas.md, sección 0.2).
@Controller('channels')
export class ChannelsInfoController {
  constructor(private readonly config: ConfigService) {}

  @Get('enabled')
  getEnabled() {
    return {
      email: true,
      telegram: this.config.get<string>('ENABLE_TELEGRAM_CHANNEL', 'true') !== 'false',
      whatsapp: this.config.get<string>('ENABLE_WHATSAPP_CHANNEL', 'false') === 'true',
    };
  }
}
