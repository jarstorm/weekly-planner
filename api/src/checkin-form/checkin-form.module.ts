import { Module } from '@nestjs/common';
import { CheckinFormController } from './checkin-form.controller';
import { CheckinFormService } from './checkin-form.service';
import { CheckinsModule } from '../checkins/checkins.module';

@Module({
  imports: [CheckinsModule],
  controllers: [CheckinFormController],
  providers: [CheckinFormService],
  exports: [CheckinFormService],
})
export class CheckinFormModule {}
