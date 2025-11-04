import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ConfigService } from './config';
import { createLogger } from './common/services/logger.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = createLogger();
  const app = await NestFactory.create(AppModule, {
    logger: logger,
  });

  // Get configuration service
  const configService = app.get(ConfigService);

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        // This will be caught by HttpExceptionFilter
        return new HttpException(
          {
            message: 'Validation failed',
            errors: errors,
          },
          HttpStatus.BAD_REQUEST,
        );
      },
    }),
  );

  // Set global prefix
  const apiPrefix = configService.apiConfig.prefix;
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix);
  }

  // CORS configuration
  const corsConfig = configService.corsConfig;
  app.enableCors({
    origin: corsConfig.origin,
    credentials: corsConfig.credentials,
  });

  // Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ordaro POS API')
    .setDescription(
      `
        Ordaro POS API with keyset (cursor-based) pagination.
      
      **Pagination:**
      - Use \`limit\` query parameter (1-100, default: 20)
      - Use \`cursor\` query parameter for next page (from pageInfo.endCursor)
      - Use \`orderBy\` query parameter ('asc' or 'desc', default: 'desc')
      
      **Example:**
      \`GET /api/v1/users?limit=20&orderBy=desc\`
      \`GET /api/v1/users?limit=20&cursor=eyJpZCI6IjEyMyJ9&orderBy=desc\`
      
      **Getting Started:**
      1. Get your Auth0 access token from Postman or Auth0
      2. Click "Authorize" button below and paste your token
      3. Test any endpoint directly from this page!
      
      **Authentication Flow:**
      - First time users: Create organization with POST /organizations
      - Logout & login again to get token with org_id claim
      - Then create branches and invite users
    `,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description:
          'Enter your Auth0 access token (get it from OAuth 2.0 flow or Postman)',
        in: 'header',
      },
      'Auth0',
    )
    .addTag('Auth', 'Authentication and user profile')
    .addTag('Organizations', 'Organization management')
    .addTag('Branches', 'Branch (restaurant location) management')
    .addTag('Users', 'User invitations and member management')
    .addTag('Plans', 'Subscription plan management')
    .addTag('Subscriptions', 'Subscription management')
    .addTag('Webhooks', 'Webhook event handlers')
    .addTag('Health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'Ordaro API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .scheme-container { background: #fafafa; padding: 20px; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = configService.port;
  await app.listen(port);

  logger.info({
    port,
    environment: configService.nodeEnv,
    apiPrefix: apiPrefix || 'none',
    swaggerDocs: `http://localhost:${port}/api-docs`,
  }, '🚀 Application started successfully');
}

bootstrap().catch((error) => {
  const logger = createLogger();
  logger.error(error, '❌ Application failed to start');
  process.exit(1);
});
