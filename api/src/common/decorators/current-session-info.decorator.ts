import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionMetadata } from '../models/interfaces/sessions.interface';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';
import * as geoIP from 'geoip-lite';

export const CurrentSessionInfo = createParamDecorator((data: unknown, ctx: ExecutionContext): SessionMetadata => {
  const request = ctx.switchToHttp().getRequest<Request>();

  const ipRaw =
    request.headers['x-forwarded-for'] || request.headers['cf-connecting-ip'] || request.socket.remoteAddress || '';

  const ip = Array.isArray(ipRaw) ? ipRaw[0].trim() : ipRaw?.trim();

  const uaString = request.headers['user-agent'];
  const parsedUa = new UAParser(uaString);
  const result = parsedUa.getResult();

  const browser = result.browser.name || 'Unknown';
  const os = result.os.name || 'Unknown';
  const deviceModel = result.device.model || 'Unknown';

  const geo = geoIP.lookup(ip);

  let location = 'Unknown';

  if (geo) {
    location = [geo.city, geo.region, geo.country].filter(Boolean).join(', ');
  }

  return {
    browser: `${browser} ${result.browser.version || ''}`,
    os: `${os} ${result.os.version || ''}`,
    device: deviceModel,
    ip: ip || 'Unknown',
    location,
    loginAt: new Date().toISOString(),
  };
});
