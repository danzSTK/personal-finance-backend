import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { OnboardingProfileDto } from './dto/onboarding-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}
  create(createUserDto: CreateUserDto) {
    const user = this.userRepository.create(createUserDto);

    return this.userRepository.save(user);
  }

  async onboardingProcess(userId: string, data: OnboardingProfileDto) {
    const user = await this.findOne(userId);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
  }

  findAll() {
    return this.userRepository.find();
  }

  async findOne(userId: string) {
    const user = await this.userRepository.findOneBy({ id: userId });

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.userRepository.findOneBy({ email });

    return user;
  }

  async findById(id: string) {
    const user = await this.userRepository.findOneBy({ id });

    return user;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
