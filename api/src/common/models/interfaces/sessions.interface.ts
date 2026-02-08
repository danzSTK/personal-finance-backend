export interface SessionMetadata {
  browser: string;
  os: string;
  device: string;
  ip: string;
  location: string;
  loginAt: string;
}

export interface ActiveSession extends SessionMetadata {
  jti: string;
}
