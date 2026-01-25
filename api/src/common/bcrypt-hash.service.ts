import { Injectable } from '@nestjs/common';
import { IHashService } from './models/interfaces/hash.service.interface';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class BcryptHashService implements IHashService {
  private readonly saltRounds = 10;

  async hash(data: string): Promise<string> {
    return bcrypt.hash(data, this.saltRounds);
  }

  async compare(data: string, encrypted: string): Promise<boolean> {
    return bcrypt.compare(data, encrypted);
  }
}
