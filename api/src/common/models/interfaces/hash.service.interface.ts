export abstract class IHashService {
  /**
   * Hashes a local credential password. Implementations must reject inputs that
   * exceed the password algorithm byte limit instead of truncating them.
   */
  abstract hash(password: string): Promise<string>;

  /**
   * Compares a local credential password without allowing algorithm-level
   * truncation of the candidate value.
   */
  abstract compare(password: string, encryptedPassword: string): Promise<boolean>;
}
