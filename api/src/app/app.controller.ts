import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  @Get()
  getAppInfo() {
    return 'Personal Finance App API is running!';
  }
}
