import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { EntityManager, Repository } from 'typeorm';

interface ICreateUserOptions {
  manager?: EntityManager;
}

interface IGetUserByEmailOptions {
  manager?: EntityManager;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto, options?: ICreateUserOptions) {
    const repository = options?.manager
      ? options.manager.getRepository(User)
      : this.userRepository;

    const user = repository.create(createUserDto);

    return repository.save(user);
  }

  findAll() {
    return this.userRepository.find();
  }

  async findOne(userId: string) {
    const user = await this.userRepository.findOneBy({ id: userId });

    return user;
  }

  async findByEmail(email: string, options?: IGetUserByEmailOptions) {
    const repository = options?.manager
      ? options.manager.getRepository(User)
      : this.userRepository;

    const user = await repository.findOneBy({ email });

    return user;
  }

  async findById(id: string) {
    const user = await this.userRepository.findOne({
      where: {
        id,
      },
    });

    return user;
  }
}
