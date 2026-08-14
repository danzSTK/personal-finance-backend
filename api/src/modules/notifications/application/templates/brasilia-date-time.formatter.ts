const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';

const brasiliaDateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BRASILIA_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const formatBrasiliaDateTime = (instant: Date): string => {
  const parts = brasiliaDateTimeFormatter.formatToParts(instant);
  const valueByType = new Map(parts.map(part => [part.type, part.value]));
  const day = valueByType.get('day');
  const month = valueByType.get('month');
  const year = valueByType.get('year');
  const hour = valueByType.get('hour');
  const minute = valueByType.get('minute');

  if (!day || !month || !year || !hour || !minute) {
    throw new RangeError('Unable to format date in Brasilia time.');
  }

  return `${day}/${month}/${year} às ${hour}:${minute}`;
};
