import { Module } from '@nestjs/common';
import { StudiesController } from './studies.controller';
import { StudiesWebhookController } from './studies-webhook.controller';
import { StudiesService } from './studies.service';
import { OrthancModule } from '../orthanc';

@Module({
  imports: [OrthancModule],
  controllers: [StudiesController, StudiesWebhookController],
  providers: [StudiesService],
  exports: [StudiesService],
})
export class StudiesModule {}
