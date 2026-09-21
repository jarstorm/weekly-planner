import { Body, Controller, Post } from '@nestjs/common';
import { CheckinsService } from './checkins.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@Controller('checkins')
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Post('manual')
  saveManual(@Body() dto: CreateCheckinDto) {
    return this.checkins.saveManual(dto);
  }
}
