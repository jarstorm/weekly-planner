import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthedUser } from '../auth/auth.service';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  listForTeam(@CurrentUser() user: AuthedUser, @Query('teamId') teamId: string) {
    return this.reports.listForTeam(user.organizationId, teamId);
  }
}
