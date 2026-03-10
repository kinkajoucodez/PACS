import { Module } from '@nestjs/common';
import { OrthancService } from './orthanc.service';

@Module({
  providers: [OrthancService],
  exports: [OrthancService],
})
export class OrthancModule {}
