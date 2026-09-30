import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { AuthModule } from '../auth/auth.module';
import { MemberVerifyModule } from '../member-verify/member-verify.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [AuthModule, MemberVerifyModule, ChannelsModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
