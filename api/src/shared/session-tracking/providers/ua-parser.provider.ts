import { Injectable } from '@nestjs/common';
import { ParsedUserAgent, UserAgentParser } from '../interfaces/user-agent-parser.interface';
import { UAParser } from 'ua-parser-js';

@Injectable()
export class UAParserProvider implements UserAgentParser {
  parse(userAgent: string): Promise<ParsedUserAgent | null> {
    const parser = new UAParser(userAgent);

    const result = parser.getResult();

    return Promise.resolve({
      browser: result.browser.name || 'Unknown',
      browserVersion: result.browser.version,
      os: result.os.name || 'Unknown',
      osVersion: result.os.version,
      device: result.device.model || 'Unknown',
    });
  }
}
