export interface GeolocationResult {
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export abstract class GeolocationService {
  abstract lookup(ip: string): Promise<GeolocationResult | null>;
}

export const GEOLOCATION_SERVICE_SYMBOL = Symbol('GEOLOCATION_SERVICE');
