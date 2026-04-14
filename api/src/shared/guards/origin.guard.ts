import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import appConfig from '../../config/app.config';
import { type ConfigType } from '@nestjs/config';
import { SKIP_ORIGIN_CHECK_KEY } from '@/common/decorators/skip-origin-check.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
    private readonly reflector: Reflector,
  ) {
    this.allowedOrigins = this.parseAllowedOrigins(appCfg.csrfAllowedOrigins);
  }

  canActivate(context: ExecutionContext): boolean {
    const shouldSkip = this.reflector.getAllAndOverride<boolean>(SKIP_ORIGIN_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (shouldSkip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    if (SAFE_METHODS.has(method)) {
      return true;
    }

    const origin = this.normalizedOrigin(request.headers.origin);
    const refererOrigin = this.extractRefererOrigin(request.headers.referer);

    // Non-browser/CLI requests usually don't send Origin/Referer.
    if (!origin && !refererOrigin) {
      return true;
    }

    if (origin && this.isAllowedOrigin(origin)) {
      return true;
    }

    if (refererOrigin && this.isAllowedOrigin(refererOrigin)) {
      return true;
    }

    throw new ForbiddenException('Forbidden: Invalid origin');
  }

  private isAllowedOrigin(origin: string): boolean {
    return this.allowedOrigins.has(origin);
  }

  private normalizedOrigin(originHeader: string | string[] | undefined): string | null {
    if (!originHeader) return null;
    const raw = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    const normalized = raw.trim().toLowerCase();

    return normalized.length > 0 ? normalized : null;
  }

  private extractRefererOrigin(refererHeader: string | string[] | undefined): string | null {
    if (!refererHeader) return null;
    const raw = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;

    try {
      return new URL(raw).origin.toLowerCase();
    } catch {
      return null;
    }
  }

  private parseAllowedOrigins(origins: string | undefined): ReadonlySet<string> {
    const values = (origins ?? '')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);

    if (values.length === 0) {
      throw new Error('CSRF_ALLOWED_ORIGINS must contain at least one origin');
    }

    return new Set(values);
  }
}
