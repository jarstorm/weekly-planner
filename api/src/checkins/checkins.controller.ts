import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
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

  // Quién respondió y quién no, para una semana — el jefe lo ve tanto en
  // curso (antes de que exista informe) como de semanas ya cerradas.
  @Get('status')
  status(@CurrentUser() user: AuthedUser, @Query('teamId') teamId: string, @Query('weekStart') weekStart: string) {
    return this.checkins.statusForTeamWeek(user.organizationId, teamId, weekStart);
  }

  @Get('export')
  async export(
    @CurrentUser() user: AuthedUser,
    @Query('teamId') teamId: string,
    @Query('weekStart') weekStart: string | undefined,
    @Res() res: Response,
  ) {
    const text = await this.checkins.exportConversations(user.organizationId, teamId, weekStart);
    const suffix = weekStart ? `-${weekStart}` : '';
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="conversaciones${suffix}.txt"`);
    res.send(text);
  }
}
