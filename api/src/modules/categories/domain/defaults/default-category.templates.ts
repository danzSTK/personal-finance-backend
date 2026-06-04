import { CategoryType, ColorToken, IconKey } from '@/common/models/enums';

export interface DefaultCategoryTemplate {
  displayName: string;
  type: CategoryType;
  colorToken: ColorToken;
  iconKey: IconKey;
  isSystem: boolean;
  includeInReports: boolean;
  sortOrder: number;
}

export const SYSTEM_CATEGORY_TEMPLATES: readonly DefaultCategoryTemplate[] = [
  {
    displayName: 'Transferência',
    type: CategoryType.TRANSFER,
    colorToken: ColorToken.BLUE,
    iconKey: IconKey.HAND_COINS,
    isSystem: true,
    includeInReports: false,
    sortOrder: 0,
  },
  {
    displayName: 'Ajuste de saldo',
    type: CategoryType.ADJUSTMENT,
    colorToken: ColorToken.SLATE,
    iconKey: IconKey.RECEIPT,
    isSystem: true,
    includeInReports: false,
    sortOrder: 1,
  },
] as const;

export const DEFAULT_USER_CATEGORY_TEMPLATES: readonly DefaultCategoryTemplate[] = [
  {
    displayName: 'Moradia',
    type: CategoryType.EXPENSE,
    colorToken: ColorToken.PURPLE,
    iconKey: IconKey.HOME,
    isSystem: false,
    includeInReports: true,
    sortOrder: 10,
  },
  {
    displayName: 'Mercado',
    type: CategoryType.EXPENSE,
    colorToken: ColorToken.EMERALD,
    iconKey: IconKey.SHOPPING_CART,
    isSystem: false,
    includeInReports: true,
    sortOrder: 20,
  },
  {
    displayName: 'Restaurante',
    type: CategoryType.EXPENSE,
    colorToken: ColorToken.ORANGE,
    iconKey: IconKey.UTENSILS,
    isSystem: false,
    includeInReports: true,
    sortOrder: 30,
  },
  {
    displayName: 'Transporte',
    type: CategoryType.EXPENSE,
    colorToken: ColorToken.BLUE,
    iconKey: IconKey.CAR,
    isSystem: false,
    includeInReports: true,
    sortOrder: 40,
  },
  {
    displayName: 'Saúde',
    type: CategoryType.EXPENSE,
    colorToken: ColorToken.RED,
    iconKey: IconKey.HEART_PULSE,
    isSystem: false,
    includeInReports: true,
    sortOrder: 50,
  },
  {
    displayName: 'Educação',
    type: CategoryType.EXPENSE,
    colorToken: ColorToken.INDIGO,
    iconKey: IconKey.GRADUATION_CAP,
    isSystem: false,
    includeInReports: true,
    sortOrder: 60,
  },
  {
    displayName: 'Lazer',
    type: CategoryType.EXPENSE,
    colorToken: ColorToken.FUCHSIA,
    iconKey: IconKey.GAMEPAD_2,
    isSystem: false,
    includeInReports: true,
    sortOrder: 70,
  },
  {
    displayName: 'Assinaturas',
    type: CategoryType.EXPENSE,
    colorToken: ColorToken.CYAN,
    iconKey: IconKey.WIFI,
    isSystem: false,
    includeInReports: true,
    sortOrder: 80,
  },
  {
    displayName: 'Impostos',
    type: CategoryType.EXPENSE,
    colorToken: ColorToken.AMBER,
    iconKey: IconKey.RECEIPT,
    isSystem: false,
    includeInReports: true,
    sortOrder: 90,
  },
  {
    displayName: 'Outros gastos',
    type: CategoryType.EXPENSE,
    colorToken: ColorToken.GRAY,
    iconKey: IconKey.CIRCLE_HELP,
    isSystem: false,
    includeInReports: true,
    sortOrder: 100,
  },
  {
    displayName: 'Salário',
    type: CategoryType.INCOME,
    colorToken: ColorToken.GREEN,
    iconKey: IconKey.BRIEFCASE_BUSINESS,
    isSystem: false,
    includeInReports: true,
    sortOrder: 10,
  },
  {
    displayName: 'Freelance',
    type: CategoryType.INCOME,
    colorToken: ColorToken.SKY,
    iconKey: IconKey.SMARTPHONE,
    isSystem: false,
    includeInReports: true,
    sortOrder: 20,
  },
  {
    displayName: 'Reembolso',
    type: CategoryType.INCOME,
    colorToken: ColorToken.TEAL,
    iconKey: IconKey.HAND_COINS,
    isSystem: false,
    includeInReports: true,
    sortOrder: 30,
  },
  {
    displayName: 'Rendimentos',
    type: CategoryType.INCOME,
    colorToken: ColorToken.LIME,
    iconKey: IconKey.TRENDING_UP,
    isSystem: false,
    includeInReports: true,
    sortOrder: 40,
  },
  {
    displayName: 'Outras receitas',
    type: CategoryType.INCOME,
    colorToken: ColorToken.GRAY,
    iconKey: IconKey.CIRCLE_HELP,
    isSystem: false,
    includeInReports: true,
    sortOrder: 50,
  },
  {
    displayName: 'Aportes',
    type: CategoryType.INVESTMENT,
    colorToken: ColorToken.VIOLET,
    iconKey: IconKey.PIGGY_BANK,
    isSystem: false,
    includeInReports: true,
    sortOrder: 10,
  },
  {
    displayName: 'Renda variável',
    type: CategoryType.INVESTMENT,
    colorToken: ColorToken.INDIGO,
    iconKey: IconKey.TRENDING_UP,
    isSystem: false,
    includeInReports: true,
    sortOrder: 20,
  },
] as const;

export const ONBOARDING_CATEGORY_TEMPLATES: readonly DefaultCategoryTemplate[] = [
  ...SYSTEM_CATEGORY_TEMPLATES,
  ...DEFAULT_USER_CATEGORY_TEMPLATES,
] as const;
