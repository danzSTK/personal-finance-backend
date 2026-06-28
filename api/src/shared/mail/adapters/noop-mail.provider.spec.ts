import { NoopMailProvider } from './noop-mail.provider';

describe('NoopMailProvider', () => {
  describe('send', () => {
    it('returns a deterministic result without external calls', async () => {
      const provider = new NoopMailProvider();

      const result = await provider.send({
        to: [{ email: 'one@example.com' }, { email: 'two@example.com' }],
        from: { email: 'no-reply@example.com' },
        subject: 'Hello',
        text: 'Hello',
      });

      expect(result).toEqual({
        provider: 'noop',
        messageId: 'noop',
        accepted: 2,
      });
    });
  });
});
