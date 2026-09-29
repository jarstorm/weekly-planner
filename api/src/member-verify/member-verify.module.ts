import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { MemberVerifyController } from './member-verify.controller';
import { MemberVerifyService } from './member-verify.service';

@Module({
  imports: [ChannelsModule],
  controllers: [MemberVerifyController],
  providers: [MemberVerifyService],
  exports: [MemberVerifyService],
})
export class MemberVerifyModule {}
