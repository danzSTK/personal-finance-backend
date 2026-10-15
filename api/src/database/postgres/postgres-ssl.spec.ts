import { parsePostgresSslFlag, resolvePostgresSsl } from './postgres-ssl';

describe('postgres-ssl', () => {
  describe('parsePostgresSslFlag', () => {
    it.each([
      ['true', true],
      ['false', false],
      ['TRUE', true],
      ['False', false],
      ['  true  ', true],
    ])('interprets %p as %p', (input, expected) => {
      expect(parsePostgresSslFlag(input)).toBe(expected);
    });

    it.each([undefined, '', '   '])('returns undefined for %p so the environment default applies', input => {
      expect(parsePostgresSslFlag(input)).toBeUndefined();
    });

    it.each(['1', 'yes', 'talvez', 'require'])('rejects the non boolean value %p', input => {
      expect(() => parsePostgresSslFlag(input)).toThrow('POSTGRES_SSL must be "true" or "false"');
    });
  });

  describe('resolvePostgresSsl', () => {
    it('keeps TLS in production when the flag is absent', () => {
      expect(resolvePostgresSsl({ isProduction: true })).toEqual({ rejectUnauthorized: false });
    });

    it('keeps TLS disabled outside production when the flag is absent', () => {
      expect(resolvePostgresSsl({ isProduction: false })).toBe(false);
    });

    it('disables TLS in production when the flag is false', () => {
      expect(resolvePostgresSsl({ isProduction: true, enabled: false })).toBe(false);
    });

    it('enables TLS outside production when the flag is true', () => {
      expect(resolvePostgresSsl({ isProduction: false, enabled: true })).toEqual({ rejectUnauthorized: false });
    });
  });
});
