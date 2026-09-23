import { Controller, Get, Param, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
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

  @Get('executive-summary')
  listForOrg(@CurrentUser() user: AuthedUser) {
    return this.reports.listForOrg(user.organizationId);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.reports.getPdf(user.organizationId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
