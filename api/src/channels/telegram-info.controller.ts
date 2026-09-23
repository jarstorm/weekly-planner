import { Controller, Get } from '@nestjs/common';
import { TelegramChannel } from './telegram.channel';

// Público, sin @UseGuards(AuthGuard) — lo consume la página de ayuda
// pública (/help/telegram) para poder enlazar directo a t.me/<bot>, que
// necesitan tanto el dueño de la cuenta como cualquier miembro sin sesión.
@Controller('telegram')
export class TelegramInfoController {
  constructor(private readonly telegram: TelegramChannel) {}

  @Get('bot-username')
  async getBotUsername() {
    return { username: await this.telegram.getBotUsername() };
  }
}
