import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

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
    .addTag('users', 'Gestão de Usuários')
    .addTag('categories', 'Gestão de Categorias')
    .addTag('transactions', 'Gestão de Transações')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
