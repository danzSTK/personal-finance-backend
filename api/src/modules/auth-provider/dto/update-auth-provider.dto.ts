import { PartialType } from '@nestjs/mapped-types';
import { CreateAuthProviderDto } from './create-auth-provider.dto';

export class UpdateAuthProviderDto extends PartialType(CreateAuthProviderDto) {}
