import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth';
import { HealthModule } from './health';
import { UsersModule } from './users';
import { ProvidersModule } from './providers';
import { StudiesModule } from './studies';
import { ReportsModule } from './reports';
import { JobsModule } from './jobs';
import { NotificationsModule } from './notifications';
import { SlaConfigModule } from './sla-config';
import { ReportTemplatesModule } from './report-templates';
import { BillingModule } from './billing';
import { DisputesModule } from './disputes';
import { RatingsModule } from './ratings';
import { AuditModule } from './audit';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    UsersModule,
    ProvidersModule,
    StudiesModule,
    ReportsModule,
    JobsModule,
    NotificationsModule,
    SlaConfigModule,
    ReportTemplatesModule,
    BillingModule,
    DisputesModule,
    RatingsModule,
    AuditModule,
  ],
})
export class AppModule {}
