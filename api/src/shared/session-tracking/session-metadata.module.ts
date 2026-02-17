import { Module } from '@nestjs/common';
import { GEOLOCATION_SERVICE_SYMBOL } from './interfaces/geolocation.interface';
import { GeoIpLiteProvider } from './providers/geoip-lite.provider';
import { USER_AGENT_PARSER_SYMBOL } from './interfaces/user-agent-parser.interface';
import { UAParserProvider } from './providers/ua-parser.provider';

@Module({
  providers: [
    {
      provide: GEOLOCATION_SERVICE_SYMBOL,
      useClass: GeoIpLiteProvider,
    },
    {
      provide: USER_AGENT_PARSER_SYMBOL,
      useClass: UAParserProvider,
    },
  ],
  exports: [GEOLOCATION_SERVICE_SYMBOL, USER_AGENT_PARSER_SYMBOL],
})
export class SessionModule {}
