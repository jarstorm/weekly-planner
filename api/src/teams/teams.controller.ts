import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateMemberDto } from './dto/create-member.dto';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  createTeam(@Body() dto: CreateTeamDto) {
    return this.teams.createTeam(dto);
  }

  @Post(':id/members')
  addMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMemberDto) {
    return this.teams.addMember(id, dto);
  }
}
