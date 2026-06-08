import {
  CATEGORY_COLOR_TOKEN_MAX_LENGTH,
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_DISPLAY_NAME_MAX_LENGTH,
  CATEGORY_DISPLAY_NAME_MIN_LENGTH,
  CATEGORY_ICON_KEY_MAX_LENGTH,
  CATEGORY_NAME_REGEX,
  isColorToken,
  isIconKey,
} from '@/common/models/constants';
import { CategoryType, ColorToken, IconKey } from '@/common/models/enums';
import { CategoryNotManageableError, InvalidCategoryError } from '@/modules/categories/domain/errors';

export interface CategoryProps {
  userId: string;
  name: string;
  displayName: string;
  description: string | null;
  type: CategoryType;
  colorToken: ColorToken | null;
  iconKey: IconKey | null;
  isSystem: boolean;
  includeInReports: boolean;
  isArchived: boolean;
  archivedAt: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryProps {
  userId: string;
  displayName: string;
  type: CategoryType;
  description?: string | null;
  colorToken?: ColorToken | null;
  iconKey?: IconKey | null;
  isSystem?: boolean;
  includeInReports?: boolean;
  sortOrder?: number;
}

export class Category {
  private constructor(
    private readonly props: CategoryProps,
    public readonly id: string,
  ) {}

  get userId(): string {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get description(): string | null {
    return this.props.description;
  }

  get type(): CategoryType {
    return this.props.type;
  }

  get colorToken(): ColorToken | null {
    return this.props.colorToken;
  }

  get iconKey(): IconKey | null {
    return this.props.iconKey;
  }

  get isSystem(): boolean {
    return this.props.isSystem;
  }

  get includeInReports(): boolean {
    return this.props.includeInReports;
  }

  get isArchived(): boolean {
    return this.props.isArchived;
  }

  get archivedAt(): Date | null {
    return this.props.archivedAt ? new Date(this.props.archivedAt) : null;
  }

  get sortOrder(): number {
    return this.props.sortOrder;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  get isVisibleInManagement(): boolean {
    return !this.isTechnical;
  }

  get canBeManagedByUser(): boolean {
    return !this.props.isSystem && !this.isTechnical;
  }

  get isEditable(): boolean {
    return this.canBeManagedByUser && !this.props.isArchived;
  }

  get isTechnical(): boolean {
    return Category.isTechnicalType(this.props.type);
  }

  static isTechnicalType(type: CategoryType): boolean {
    return type === CategoryType.TRANSFER || type === CategoryType.ADJUSTMENT;
  }

  static canBeCreatedManually(type: CategoryType): boolean {
    return !Category.isTechnicalType(type);
  }

  static normalizeNameForSearch(value: string): string | null {
    const name = Category.normalizeName(value);

    return CATEGORY_NAME_REGEX.test(name) ? name : null;
  }

  static create(props: CreateCategoryProps, id: string): Category {
    const now = new Date();
    const displayName = Category.validateDisplayName(props.displayName);
    const name = Category.generateName(displayName);

    Category.validateDescription(props.description ?? null);
    Category.validateColorToken(props.colorToken ?? null);
    Category.validateIconKey(props.iconKey ?? null);
    Category.validateSortOrder(props.sortOrder ?? 0);

    return new Category(
      {
        userId: props.userId,
        name,
        displayName,
        description: props.description ?? null,
        type: props.type,
        colorToken: props.colorToken ?? null,
        iconKey: props.iconKey ?? null,
        isSystem: props.isSystem ?? false,
        includeInReports: props.includeInReports ?? true,
        isArchived: false,
        archivedAt: null,
        sortOrder: props.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      },
      id,
    );
  }

  static reconstitute(props: CategoryProps, id: string): Category {
    return new Category(props, id);
  }

  rename(displayName: string): void {
    if (!this.isEditable) {
      throw new CategoryNotManageableError('Cannot rename a system or non-editable category.');
    }

    const validatedDisplayName = Category.validateDisplayName(displayName);

    this.props.displayName = validatedDisplayName;
    this.props.name = Category.generateName(validatedDisplayName);
    this.props.updatedAt = new Date();
  }

  changeDescription(description: string | null): void {
    if (!this.isEditable) {
      throw new CategoryNotManageableError('Cannot change description of a system or non-editable category.');
    }

    Category.validateDescription(description);

    this.props.description = description;
    this.props.updatedAt = new Date();
  }

  changeColorToken(colorToken: ColorToken | null): void {
    if (!this.isEditable) {
      throw new CategoryNotManageableError('Cannot change color token of a system or non-editable category.');
    }

    Category.validateColorToken(colorToken);

    this.props.colorToken = colorToken;
    this.props.updatedAt = new Date();
  }

  changeIconKey(iconKey: IconKey | null): void {
    if (!this.isEditable) {
      throw new CategoryNotManageableError('Cannot change icon key of a system or non-editable category.');
    }

    Category.validateIconKey(iconKey);

    this.props.iconKey = iconKey;
    this.props.updatedAt = new Date();
  }

  changeIncludeInReports(includeInReports: boolean): void {
    if (!this.isEditable) {
      throw new CategoryNotManageableError('Cannot change report inclusion of a system or non-editable category.');
    }

    this.props.includeInReports = includeInReports;
    this.props.updatedAt = new Date();
  }

  changeSortOrder(sortOrder: number): void {
    if (!this.isEditable) {
      throw new CategoryNotManageableError('Cannot change sort order of a system or non-editable category.');
    }

    Category.validateSortOrder(sortOrder);

    this.props.sortOrder = sortOrder;
    this.props.updatedAt = new Date();
  }

  archive(): void {
    if (this.props.isArchived) {
      return;
    }

    if (!this.canBeManagedByUser) {
      throw new CategoryNotManageableError('Cannot archive a system or non-editable category.');
    }

    this.props.isArchived = true;
    this.props.archivedAt = new Date();
    this.props.updatedAt = new Date();
  }

  unarchive(): void {
    if (!this.props.isArchived) {
      return;
    }

    if (!this.canBeManagedByUser) {
      throw new CategoryNotManageableError('Cannot unarchive a system or non-editable category.');
    }

    this.props.isArchived = false;
    this.props.archivedAt = null;
    this.props.updatedAt = new Date();
  }

  private static generateName(displayName: string): string {
    const name = Category.normalizeName(displayName);

    if (!CATEGORY_NAME_REGEX.test(name)) {
      throw new InvalidCategoryError(
        'Category name must contain at least one letter and only lowercase letters separated by hyphens.',
      );
    }

    return name;
  }

  private static normalizeName(value: string): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private static validateDisplayName(displayName: string): string {
    const trimmed = displayName.trim();

    if (trimmed.length < CATEGORY_DISPLAY_NAME_MIN_LENGTH || trimmed.length > CATEGORY_DISPLAY_NAME_MAX_LENGTH) {
      throw new InvalidCategoryError(
        `Category display name must be between ${CATEGORY_DISPLAY_NAME_MIN_LENGTH} and ${CATEGORY_DISPLAY_NAME_MAX_LENGTH} characters.`,
      );
    }

    return trimmed;
  }

  private static validateDescription(description: string | null): void {
    if (description !== null && description.length > CATEGORY_DESCRIPTION_MAX_LENGTH) {
      throw new InvalidCategoryError(
        `Category description must be at most ${CATEGORY_DESCRIPTION_MAX_LENGTH} characters.`,
      );
    }
  }

  private static validateColorToken(colorToken: ColorToken | null): void {
    if (colorToken === null) {
      return;
    }

    if (colorToken.trim() === '' || colorToken.length > CATEGORY_COLOR_TOKEN_MAX_LENGTH || !isColorToken(colorToken)) {
      throw new InvalidCategoryError('Category color token must be one of the official product color tokens.');
    }
  }

  private static validateIconKey(iconKey: IconKey | null): void {
    if (iconKey === null) {
      return;
    }

    if (iconKey.trim() === '' || iconKey.length > CATEGORY_ICON_KEY_MAX_LENGTH || !isIconKey(iconKey)) {
      throw new InvalidCategoryError('Category icon key must be one of the official product icon keys.');
    }
  }

  private static validateSortOrder(sortOrder: number): void {
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new InvalidCategoryError('Sort order must be a non-negative integer.');
    }
  }
}
