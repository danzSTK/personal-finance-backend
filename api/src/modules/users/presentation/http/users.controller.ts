import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { CreateUserUseCase } from '../../application/use-cases/create-user/create-user.use-case';
import { FindUserByIdUseCase } from '../../application/use-cases/find-user-by-id/find-user-by-id.use-case';

@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly findByUserIdUseCase: FindUserByIdUseCase,
  ) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.createUserUseCase.execute(createUserDto);

    return {
      id: user.id,
      email: user.email.value,
      userName: user.userName?.value ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Get()
  findAll() {
    return 'Next update';
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.findByUserIdUseCase.execute(id);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email.value,
      userName: user.userName?.value ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
