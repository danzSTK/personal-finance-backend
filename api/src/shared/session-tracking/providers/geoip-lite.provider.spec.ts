import * as geoIp from 'geoip-lite';
import { GeoIpLiteProvider } from './geoip-lite.provider';

jest.mock('geoip-lite', () => ({
  lookup: jest.fn(),
}));

describe('GeoIpLiteProvider', () => {
  const lookupMock = geoIp.lookup as jest.MockedFunction<typeof geoIp.lookup>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('lookup', () => {
    it('maps the external lookup result to the geolocation contract', async () => {
      lookupMock.mockReturnValue({
        range: [134744064, 134744319],
        country: 'US',
        region: 'CA',
        eu: '0',
        timezone: 'America/Los_Angeles',
        city: 'Mountain View',
        ll: [37.4056, -122.0775],
        metro: 807,
        area: 1000,
      });
      const provider = new GeoIpLiteProvider();

      const result = await provider.lookup('8.8.8.8');

      expect(lookupMock).toHaveBeenCalledWith('8.8.8.8');
      expect(result).toEqual({
        country: 'US',
        region: 'CA',
        city: 'Mountain View',
        latitude: 37.4056,
        longitude: -122.0775,
      });
    });

    it('returns null when the external lookup has no match', async () => {
      lookupMock.mockReturnValue(null);
      const provider = new GeoIpLiteProvider();

      await expect(provider.lookup('127.0.0.1')).resolves.toBeNull();
    });
  });
});
