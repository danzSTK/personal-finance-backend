import { normalizeIpAddress, resolveTrustedClientIp } from '@/common/utils/client-ip.util';
import { Request } from 'express';

describe('client IP utilities', () => {
  describe('normalizeIpAddress', () => {
    it.each([
      ['::ffff:203.0.113.10', '203.0.113.10'],
      ['203.0.113.10:443', '203.0.113.10'],
      ['[2001:db8::1]:443', '2001:db8::1'],
      ['2001:db8::1', '2001:db8::1'],
    ])('normalizes %s', (raw, expected) => {
      expect(normalizeIpAddress(raw)).toBe(expected);
    });

    it('rejects malformed addresses', () => {
      expect(normalizeIpAddress('not-an-ip')).toBeNull();
    });
  });

  describe('resolveTrustedClientIp', () => {
    it('uses the IP resolved by Express and ignores raw forwarding headers', () => {
      const request = {
        ip: '203.0.113.10',
        headers: {
          'x-forwarded-for': '198.51.100.99',
          'cf-connecting-ip': '198.51.100.100',
        },
        socket: {
          remoteAddress: '192.0.2.1',
        },
      } as unknown as Request;

      expect(resolveTrustedClientIp(request)).toBe('203.0.113.10');
    });

    it('falls back to the socket address', () => {
      const request = {
        ip: undefined,
        socket: {
          remoteAddress: '::ffff:192.0.2.1',
        },
      } as unknown as Request;

      expect(resolveTrustedClientIp(request)).toBe('192.0.2.1');
    });
  });
});
