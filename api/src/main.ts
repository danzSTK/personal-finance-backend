import { NestFactory } from '@nestjs/core';
import { ApiModule } from '@/app/api/api.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppStatus } from '@/common/models/enums';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createValidationException } from '@/common/validation';
import { ProcessRoles } from '@/common/models/constants/process-role.constants';
import { assertProcessRole } from '@/app/shared/assert-process-role';

async function bootstrap() {
  assertProcessRole(ProcessRoles.API);
  const app = await NestFactory.create<NestExpressApplication>(ApiModule);
  app.enableShutdownHooks();
  app.use(cookieParser());
  const isProduction = process.env.NODE_ENV === AppStatus.PRODUCTION;

  app.set('trust proxy', isProduction ? 1 : false);

  app.enableCors({
    origin: isProduction ? process.env.FRONTEND_URL : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.use(
    helmet({
      hsts: isProduction,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove proprieades não decoradas
      forbidNonWhitelisted: true, // Lança erro se houver propriedades extras
      transform: true, // Transforma payloads para DTOs
      transformOptions: {
        enableImplicitConversion: true, // Habilita conversão implícita de tipos
      },
      exceptionFactory: createValidationException,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Finance App API')
    .setDescription('API de controle financeiro')
    .setVersion('1.0')
    .addTag('auth', 'Autenticação e Sessões')
    .addTag('users', 'Perfil e dados do usuário autenticado')
    .addTag('health', 'Health checks da aplicação')
    .addTag('app', 'Informações públicas da API')
    .addBearerAuth()
    .addCookieAuth(
      'accessToken',
      {
        type: 'apiKey',
        in: 'cookie',
      },
      'accessToken',
    )
    .addCookieAuth(
      'refreshToken',
      {
        type: 'apiKey',
        in: 'cookie',
      },
      'refreshToken',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
