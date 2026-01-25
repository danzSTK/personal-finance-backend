import { Module } from '@nestjs/common';
import { IHashService } from './models/interfaces/hash.service.interface';
import { BcryptHashService } from './bcrypt-hash.service';

@Module({
  providers: [
    {
      provide: IHashService,
      useClass: BcryptHashService,
    },
  ],
  exports: [IHashService],
})
export class CommonModule {}
