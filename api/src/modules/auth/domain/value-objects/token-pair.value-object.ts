export class TokenPair {
  private constructor(
    private readonly _accessToken: string,
    private readonly _refreshToken: string,
  ) {}

  get accessToken(): string {
    return this._accessToken;
  }

  get refreshToken(): string {
    return this._refreshToken;
  }

  static create(accessToken: string, refreshToken: string): TokenPair {
    return new TokenPair(accessToken, refreshToken);
  }

  static reconstitute(accessToken: string, refreshToken: string): TokenPair {
    return new TokenPair(accessToken, refreshToken);
  }
}
