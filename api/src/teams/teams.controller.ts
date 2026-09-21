import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthedUser } from '../auth/auth.service';

@Controller('teams')
@UseGuards(AuthGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  listOwn(@CurrentUser() user: AuthedUser) {
    return this.teams.listOwn(user.organizationId);
  }

  @Post()
  createTeam(@CurrentUser() user: AuthedUser, @Body() dto: CreateTeamDto) {
    return this.teams.createTeam(user.organizationId, dto);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMemberDto,
  ) {
    return this.teams.addMember(user.organizationId, id, dto);
  }
}
