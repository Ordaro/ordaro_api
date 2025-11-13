import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

/**
 * API Key Guard for securing endpoints that should only be accessible
 * with a valid API key (e.g., Auth0 Actions calling NestJS endpoints)
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly validApiKey: string;

  constructor(private readonly configService: ConfigService) {
    // Get API key from environment variables
    this.validApiKey =
      this.configService.get<string>('app.auth0.emailApiKey') ||
      process.env['AUTH0_EMAIL_API_KEY'] ||
      '';

    if (!this.validApiKey) {
      this.logger.warn(
        'AUTH0_EMAIL_API_KEY not configured. API key authentication will fail.',
      );
    }
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || request.headers['X-API-Key'];

    if (!apiKey) {
      this.logger.warn('API key missing in request headers', {
        method: request.method,
        url: request.url,
        headers: Object.keys(request.headers),
      });
      throw new UnauthorizedException('API key is required');
    }

    if (apiKey !== this.validApiKey) {
      this.logger.warn('Invalid API key provided', {
        method: request.method,
        url: request.url,
        providedKeyPreview: apiKey
          ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
          : 'none',
      });
      throw new UnauthorizedException('Invalid API key');
    }

    this.logger.debug('API key validated successfully', {
      method: request.method,
      url: request.url,
    });

    return true;
  }
}
