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
  ],
})
export class AppModule {}
