import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionMetadata } from '../models/interfaces/sessions.interface';
import { Request } from 'express';
import { GeoIpLiteProvider } from '@/shared/session-tracking/providers/geoip-lite.provider';
import { UAParserProvider } from '@/shared/session-tracking/providers/ua-parser.provider';

export const CurrentSessionInfo = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext): Promise<SessionMetadata> => {
    const request = ctx.switchToHttp().getRequest<Request>();

    const geoService = new GeoIpLiteProvider();
    const uaParser = new UAParserProvider();

    const ipRaw =
      request.headers['x-forwarded-for'] || request.headers['cf-connecting-ip'] || request.socket.remoteAddress || '';

    const ip = Array.isArray(ipRaw) ? ipRaw[0].trim() : ipRaw?.trim();

    const uaString = request.headers['user-agent'];
    const parsedUa = await uaParser.parse(uaString ?? '');
    const geo = await geoService.lookup(ip);

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
