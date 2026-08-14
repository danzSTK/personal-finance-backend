import { formatBrasiliaDateTime } from '@/modules/notifications/application/templates/brasilia-date-time.formatter';

describe('formatBrasiliaDateTime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('format', () => {
    it('converts an instant to the America/Sao_Paulo timezone', () => {
      expect(formatBrasiliaDateTime(new Date('2026-08-11T12:00:00.000Z'))).toBe('11/08/2026 às 09:00');
    });

    it('formats midnight without using hour 24', () => {
      expect(formatBrasiliaDateTime(new Date('2026-08-11T03:00:00.000Z'))).toBe('11/08/2026 às 00:00');
    });

    it('rejects an invalid instant', () => {
      expect(() => formatBrasiliaDateTime(new Date(Number.NaN))).toThrow(RangeError);
    });
  });
});
