import { Injectable } from '@nestjs/common';
import { GeolocationResult, GeolocationService } from '../interfaces/geolocation.interface';
import * as geoIp from 'geoip-lite';

@Injectable()
export class GeoIpLiteProvider implements GeolocationService {
  lookup(ip: string): Promise<GeolocationResult | null> {
    const geo = geoIp.lookup(ip);
    if (!geo) {
      return Promise.resolve(null);
    }

    const result: GeolocationResult = {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      latitude: geo.ll?.[0],
      longitude: geo.ll?.[1],
    };

    return Promise.resolve(result);
  }
}
