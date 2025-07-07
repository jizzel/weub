import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200', // Default to Angular dev server
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Weub Video Streaming API')
    .setDescription('A minimal video streaming application API')
    .setVersion('1.0')
    .addTag('videos', 'Video management endpoints')
    .addTag('streaming', 'Video streaming endpoints')
    .addTag('health', 'System health endpoints')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
