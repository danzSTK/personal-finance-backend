import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppStatus } from './common/models/enums';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProduction = process.env.NODE_ENV === AppStatus.PRODUCTION;

  app.set('trust proxy', 1); // Habilita o reconhecimento de proxies reversos

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
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove proprieades não decoradas
      forbidNonWhitelisted: true, // Lança erro se houver propriedades extras
      transform: true, // Transforma payloads para DTOs
      transformOptions: {
        enableImplicitConversion: true, // Habilita conversão implícita de tipos
      },
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
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
