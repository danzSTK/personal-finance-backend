import { ColorToken, IconKey } from '@/common/models/enums';

export interface IconTokenMetadata {
  key: IconKey;
  label: string;
}

export interface ColorTokenMetadata {
  key: ColorToken;
  label: string;
  hex: string;
}

export const APP_ICON_TOKENS: readonly IconTokenMetadata[] = [
  { key: IconKey.WALLET, label: 'Carteira' },
  { key: IconKey.LANDMARK, label: 'Banco' },
  { key: IconKey.CREDIT_CARD, label: 'Cartão de crédito' },
  { key: IconKey.BANKNOTE, label: 'Dinheiro' },
  { key: IconKey.COINS, label: 'Moedas' },
  { key: IconKey.PIGGY_BANK, label: 'Reserva' },
  { key: IconKey.UTENSILS, label: 'Alimentação' },
  { key: IconKey.SHOPPING_CART, label: 'Compras' },
  { key: IconKey.CAR, label: 'Carro' },
  { key: IconKey.BUS, label: 'Ônibus' },
  { key: IconKey.TRAIN, label: 'Transporte público' },
  { key: IconKey.HOME, label: 'Moradia' },
  { key: IconKey.HEART_PULSE, label: 'Saúde' },
  { key: IconKey.STETHOSCOPE, label: 'Médico' },
  { key: IconKey.GAMEPAD_2, label: 'Jogos' },
  { key: IconKey.FILM, label: 'Cinema' },
  { key: IconKey.MUSIC, label: 'Música' },
  { key: IconKey.DUMBBELL, label: 'Academia' },
  { key: IconKey.GRADUATION_CAP, label: 'Educação' },
  { key: IconKey.BOOK_OPEN, label: 'Estudos' },
  { key: IconKey.PLANE, label: 'Viagem' },
  { key: IconKey.FUEL, label: 'Combustível' },
  { key: IconKey.WIFI, label: 'Internet' },
  { key: IconKey.SMARTPHONE, label: 'Celular' },
  { key: IconKey.LIGHTBULB, label: 'Energia' },
  { key: IconKey.SHIELD, label: 'Seguro' },
  { key: IconKey.GIFT, label: 'Presentes' },
  { key: IconKey.BRIEFCASE_BUSINESS, label: 'Trabalho' },
  { key: IconKey.TRENDING_UP, label: 'Investimentos' },
  { key: IconKey.CIRCLE_HELP, label: 'Outros' },
  { key: IconKey.RECEIPT, label: 'Contas' },
  { key: IconKey.HAND_COINS, label: 'Recebimentos' },
] as const;

export const APP_COLOR_TOKENS: readonly ColorTokenMetadata[] = [
  { key: ColorToken.SLATE, label: 'Ardosia', hex: '#64748B' },
  { key: ColorToken.GRAY, label: 'Cinza', hex: '#6B7280' },
  { key: ColorToken.ZINC, label: 'Zinco', hex: '#71717A' },
  { key: ColorToken.RED, label: 'Vermelho', hex: '#EF4444' },
  { key: ColorToken.ORANGE, label: 'Laranja', hex: '#F97316' },
  { key: ColorToken.AMBER, label: 'Âmbar', hex: '#F59E0B' },
  { key: ColorToken.YELLOW, label: 'Amarelo', hex: '#EAB308' },
  { key: ColorToken.LIME, label: 'Lima', hex: '#84CC16' },
  { key: ColorToken.GREEN, label: 'Verde', hex: '#22C55E' },
  { key: ColorToken.EMERALD, label: 'Esmeralda', hex: '#10B981' },
  { key: ColorToken.TEAL, label: 'Verde azulado', hex: '#14B8A6' },
  { key: ColorToken.CYAN, label: 'Ciano', hex: '#06B6D4' },
  { key: ColorToken.SKY, label: 'Céu', hex: '#0EA5E9' },
  { key: ColorToken.BLUE, label: 'Azul', hex: '#3B82F6' },
  { key: ColorToken.INDIGO, label: 'Índigo', hex: '#6366F1' },
  { key: ColorToken.VIOLET, label: 'Violeta', hex: '#8B5CF6' },
  { key: ColorToken.PURPLE, label: 'Roxo', hex: '#A855F7' },
  { key: ColorToken.FUCHSIA, label: 'Fúcsia', hex: '#D946EF' },
  { key: ColorToken.PINK, label: 'Rosa', hex: '#EC4899' },
  { key: ColorToken.ROSE, label: 'Rose', hex: '#F43F5E' },
] as const;

export function isIconKey(value: string): value is IconKey {
  return Object.values(IconKey).includes(value as IconKey);
}

export function isColorToken(value: string): value is ColorToken {
  return Object.values(ColorToken).includes(value as ColorToken);
}
