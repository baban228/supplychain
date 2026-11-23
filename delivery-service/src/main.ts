import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use((
    request: { headers: Record<string, string | string[] | undefined> },
    response: { setHeader(name: string, value: string): void },
    next: () => void,
  ) => {
    const requestId = request.headers['x-request-id'];
    const validRequestId =
      typeof requestId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(requestId);
    const resolvedRequestId = validRequestId ? requestId : randomUUID();
    request.headers['x-request-id'] = resolvedRequestId;
    response.setHeader('X-Request-ID', resolvedRequestId);
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('Delivery Service')
    .setDescription('API управления доставками')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
