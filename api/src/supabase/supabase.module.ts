import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { MigrationRunnerService } from './migration-runner.service';

@Global()
@Module({
  providers: [SupabaseService, MigrationRunnerService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
