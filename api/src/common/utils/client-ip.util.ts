import { Request } from 'express';
import { isIP } from 'node:net';

export function normalizeIpAddress(rawAddress: string | null | undefined): string | null {
  if (!rawAddress) {
    return null;
  }

  let candidate = rawAddress.trim();

  if (!candidate) {
    return null;
  }

  if (candidate.startsWith('::ffff:')) {
    candidate = candidate.slice('::ffff:'.length);
  }

  const bracketedIpv6 = candidate.match(/^\[([^\]]+)\](?::\d+)?$/);

  if (bracketedIpv6) {
    candidate = bracketedIpv6[1];
  }

  const ipv4WithPort = candidate.match(/^(.+):(\d+)$/);

  if (ipv4WithPort && isIP(ipv4WithPort[1]) === 4) {
    candidate = ipv4WithPort[1];
  }

  return isIP(candidate) === 0 ? null : candidate;
}

export function resolveTrustedClientIp(request: Request): string | null {
  const expressResolvedIp = normalizeIpAddress(request.ip);

  if (expressResolvedIp) {
    return expressResolvedIp;
  }

  return normalizeIpAddress(request.socket.remoteAddress);
}
