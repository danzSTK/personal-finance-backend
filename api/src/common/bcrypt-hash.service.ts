import { PasswordByteLimitExceededError } from '@/common/domain/errors';
import { IHashService } from '@/common/models/interfaces';
import { isPasswordWithinUtf8ByteLimit } from '@/common/utils/password-byte-length.util';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class BcryptHashService implements IHashService {
  private readonly saltRounds = 10;

  async hash(password: string): Promise<string> {
    this.assertPasswordWithinByteLimit(password);

    return bcrypt.hash(password, this.saltRounds);
  }

  async compare(password: string, encryptedPassword: string): Promise<boolean> {
    this.assertPasswordWithinByteLimit(password);

    return bcrypt.compare(password, encryptedPassword);
  }

  private assertPasswordWithinByteLimit(password: string): void {
    if (!isPasswordWithinUtf8ByteLimit(password)) {
      throw new PasswordByteLimitExceededError();
    }
  }
}
