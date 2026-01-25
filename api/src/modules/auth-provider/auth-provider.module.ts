import { Module } from '@nestjs/common';
import { AuthProviderService } from './auth-provider.service';
import { AuthProviderController } from './auth-provider.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthProvider } from '../auth/entities/auth-provider.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuthProvider]), UsersModule],
  controllers: [AuthProviderController],
  providers: [AuthProviderService],
  exports: [AuthProviderService],
})
export class AuthProviderModule {}
