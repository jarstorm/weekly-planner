import { Module } from '@nestjs/common';
import { CheckinsController } from './checkins.controller';
import { CheckinsService } from './checkins.service';
import { AuthModule } from '../auth/auth.module';
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [AuthModule, AudioModule],
  controllers: [CheckinsController],
  providers: [CheckinsService],
  exports: [CheckinsService],
})
export class CheckinsModule {}
