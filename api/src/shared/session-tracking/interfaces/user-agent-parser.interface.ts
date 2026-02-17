export interface ParsedUserAgent {
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: string;
}

export abstract class UserAgentParser {
  abstract parse(userAgent: string): Promise<ParsedUserAgent | null>;
}

export const USER_AGENT_PARSER_SYMBOL = Symbol('USER_AGENT_PARSER');
