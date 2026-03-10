import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlaMonitoringService } from './sla-monitoring.service';
import { AutoAssignmentService } from './auto-assignment.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SlaMonitoringService, AutoAssignmentService],
  exports: [AutoAssignmentService],
})
export class JobsModule {}
