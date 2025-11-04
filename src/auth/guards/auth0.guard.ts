import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class Auth0Guard extends AuthGuard('auth0') {
  private readonly logger = new Logger(Auth0Guard.name);

  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // Debug: Log incoming request with token info
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      this.logger.debug('🔐 Token received in request:', {
        method: request.method,
        url: request.url,
        hasAuthHeader: !!authHeader,
        tokenPreview: token ? `${token.substring(0, 20)}...${token.substring(token.length - 10)}` : 'none',
        tokenLength: token?.length || 0,
        fullToken: token, // Full token for debugging
      });
    } else {
      this.logger.warn('⚠️ Request received without Authorization header:', {
        method: request.method,
        url: request.url,
      });
    }

    return super.canActivate(context);
  }

  override handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (err) {
      this.logger.error('❌ Token validation error:', {
        error: err.message || err,
        method: request.method,
        url: request.url,
      });
      throw err;
    }

    if (!user && info) {
      this.logger.warn('⚠️ Token validation failed (no user, info provided):', {
        info: info.message || info,
        method: request.method,
        url: request.url,
      });
    }

    if (user) {
      this.logger.debug('✅ Token validated successfully - User authenticated:', {
        auth0Id: user.auth0Id,
        email: user.email,
        organizationId: user.organizationId || 'none',
        role: user.role,
        method: request.method,
        url: request.url,
      });
    }

    return super.handleRequest(err, user, info, context);
  }
}
