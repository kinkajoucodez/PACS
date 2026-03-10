import { Module } from '@nestjs/common';
import { SlaConfigController } from './sla-config.controller';
import { SlaConfigService } from './sla-config.service';
import { PrismaModule } from '../prisma';

@Module({
  imports: [PrismaModule],
  controllers: [SlaConfigController],
  providers: [SlaConfigService],
  exports: [SlaConfigService],
})
export class SlaConfigModule {}
