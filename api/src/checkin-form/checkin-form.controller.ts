import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CheckinFormService } from './checkin-form.service';
import { SubmitCheckinFormDto } from './dto/submit-checkin-form.dto';

// Sin AuthGuard a propósito: el token firmado en la URL ES la credencial
// (el empleado no tiene cuenta ni login — ver docs/especificaciones-tecnicas.md
// sección 3.4). Mismo criterio de confianza que los webhooks de mensajería.
@Controller('checkins/form')
export class CheckinFormController {
  constructor(private readonly checkinForm: CheckinFormService) {}

  @Get()
  get(@Query('token') token: string) {
    return this.checkinForm.getForm(token);
  }

  @Post()
  submit(@Body() dto: SubmitCheckinFormDto) {
    return this.checkinForm.submit(dto);
  }
}
