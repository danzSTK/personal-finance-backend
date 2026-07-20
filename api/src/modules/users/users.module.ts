import { Module } from '@nestjs/common';
import { UsersController } from './presentation/http/users.controller';
import { UsersCoreModule } from './users-core.module';

@Module({
  imports: [UsersCoreModule],
  controllers: [UsersController],
  exports: [UsersCoreModule],
})
export class UsersModule {}
