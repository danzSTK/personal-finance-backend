import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionMetadata } from '../models/interfaces/sessions.interface';
import { Request } from 'express';
import { isIP } from 'node:net';
import { GeoIpLiteProvider } from '@/shared/session-tracking/providers/geoip-lite.provider';
import { UAParserProvider } from '@/shared/session-tracking/providers/ua-parser.provider';

function normalizeIp(raw: string): string | null {
  const firstValue = raw.split(',')[0]?.trim();
  if (!firstValue) {
    return null;
  }

  let candidate = firstValue;

  if (candidate.startsWith('::ffff:')) {
    candidate = candidate.slice(7);
  }

  if (candidate.startsWith('[') && candidate.includes(']')) {
    candidate = candidate.slice(1, candidate.indexOf(']'));
  }

  const hasSingleColon = candidate.indexOf(':') === candidate.lastIndexOf(':');
  if (hasSingleColon) {
    const [host, port] = candidate.split(':');
    if (host && port && isIP(host) === 4 && /^\d+$/.test(port)) {
      candidate = host;
    }
  }

  return isIP(candidate) ? candidate : null;
}

function resolveClientIp(request: Request): string {
  const candidates: Array<string | string[] | undefined> = [
    request.headers['cf-connecting-ip'],
    request.headers['x-real-ip'],
    request.headers['x-forwarded-for'],
    request.ip,
    request.socket.remoteAddress,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (Array.isArray(candidate)) {
      for (const value of candidate) {
        const normalized = normalizeIp(value);
        if (normalized) {
          return normalized;
        }
      }
      continue;
    }

    const normalized = normalizeIp(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return 'Unknown';
}

export const CurrentSessionInfo = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext): Promise<SessionMetadata> => {
    const request = ctx.switchToHttp().getRequest<Request>();

    const geoService = new GeoIpLiteProvider();
    const uaParser = new UAParserProvider();
    const ip = resolveClientIp(request);

    const uaString = request.headers['user-agent'];
    const parsedUa = await uaParser.parse(uaString ?? '');
    const geo = ip === 'Unknown' ? null : await geoService.lookup(ip);

    const browser = parsedUa?.browser || 'Unknown';
    const os = parsedUa?.os || 'Unknown';
    const deviceModel = parsedUa?.device || 'Unknown';

    let location = 'Unknown';

    if (geo) {
      location = [geo.city, geo.region, geo.country].filter(Boolean).join(', ');
    }

    return {
      browser: `${browser} ${parsedUa?.browserVersion || ''}`,
      os: `${os} ${parsedUa?.osVersion || ''}`,
      device: deviceModel,
      ip: ip || 'Unknown',
      location,
      loginAt: new Date().toISOString(),
    };
  },
);
