import {
  ACCOUNT_COLOR_TOKEN_MAX_LENGTH,
  ACCOUNT_ICON_KEY_MAX_LENGTH,
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_NAME_MIN_LENGTH,
  isColorToken,
  isIconKey,
} from '@/common/models/constants';
import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import {
  AccountArchivedMutationError,
  AccountCannotBeArchivedError,
  AccountCannotBeDefaultError,
  InvalidAccountError,
  InvalidAccountNameError,
} from '@/modules/accounts/domain/errors';

export interface AccountProps {
  userId: string;
  name: string;
  type: AccountType;
  initialBalanceCents: number;
  color: ColorToken | null;
  icon: IconKey | null;
  includeInTotal: boolean;
  isArchived: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Account {
  private constructor(
    private readonly props: AccountProps,
    public readonly id: string,
  ) {}

  get userId(): string {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name;
  }

  get type(): AccountType {
    return this.props.type;
  }

  get initialBalanceCents(): number {
    return this.props.initialBalanceCents;
  }

  get color(): ColorToken | null {
    return this.props.color;
  }

  get icon(): IconKey | null {
    return this.props.icon;
  }

  get includeInTotal(): boolean {
    return this.props.includeInTotal;
  }

  get isArchived(): boolean {
    return this.props.isArchived;
  }

  get isDefault(): boolean {
    return this.props.isDefault;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  changerName(name: string): void {
    if (this.props.name === name) {
      return;
    }

    if (this.props.isArchived) {
      throw new AccountArchivedMutationError('Cannot change name of an archived account.');
    }

    if (!name || name.trim() === '' || name.length > ACCOUNT_NAME_MAX_LENGTH || name.length < ACCOUNT_NAME_MIN_LENGTH) {
      throw new InvalidAccountNameError();
    }

    this.props.name = name;
    this.props.updatedAt = new Date();
  }

  // TODO: Pensar se devemos permitir mudanças quando o tipo for CASH, já que isso pode impactar a forma como as transações são tratadas
  changerType(type: AccountType) {
    if (this.props.type === type) {
      return;
    }

    if (this.props.isArchived) {
      throw new AccountArchivedMutationError('Cannot change type of an archived account.');
    }

    this.props.type = type;
    this.props.updatedAt = new Date();
  }

  changerColor(color: ColorToken | null) {
    if (this.props.color === color) {
      return;
    }

    if (this.props.isArchived) {
      throw new AccountArchivedMutationError('Cannot change color of an archived account.');
    }

    if (color && (color.trim() === '' || color.length > ACCOUNT_COLOR_TOKEN_MAX_LENGTH || !isColorToken(color))) {
      throw new InvalidAccountError('Invalid account color.');
    }

    this.props.color = color;
    this.props.updatedAt = new Date();
  }

  changerIcon(icon: IconKey | null) {
    if (this.props.icon === icon) {
      return;
    }

    if (this.props.isArchived) {
      throw new AccountArchivedMutationError('Cannot change icon of an archived account.');
    }

    if (icon && (icon.trim() === '' || icon.length > ACCOUNT_ICON_KEY_MAX_LENGTH || !isIconKey(icon))) {
      throw new InvalidAccountError('Invalid account icon.');
    }

    this.props.icon = icon;
    this.props.updatedAt = new Date();
  }

  changerIncludeInTotal(includeInTotal: boolean) {
    if (this.props.includeInTotal === includeInTotal) {
      return;
    }

    if (this.props.isArchived) {
      throw new AccountArchivedMutationError('Cannot change includeInTotal of an archived account.');
    }

    this.props.includeInTotal = includeInTotal;
    this.props.updatedAt = new Date();
  }

  archive(): void {
    if (this.props.isDefault) {
      throw new AccountCannotBeArchivedError('Default account cannot be archived.');
    }

    if (this.props.isArchived) {
      return;
    }

    this.props.isArchived = true;
    this.props.updatedAt = new Date();
  }

  unarchive(): void {
    if (!this.props.isArchived) {
      return;
    }

    this.props.isArchived = false;
    this.props.updatedAt = new Date();
  }

  setAsDefault(): void {
    if (this.props.isArchived) {
      throw new AccountCannotBeDefaultError('Archived account cannot be set as default.');
    }

    if (this.props.isDefault) {
      return;
    }

    this.props.isDefault = true;
    this.props.updatedAt = new Date();
  }

  unsetAsDefault(): void {
    if (!this.props.isDefault) {
      return;
    }
    this.props.isDefault = false;
    this.props.updatedAt = new Date();
  }

  static create(props: AccountProps, id: string): Account {
    if (!Number.isSafeInteger(props.initialBalanceCents) || props.initialBalanceCents < 0) {
      throw new InvalidAccountError('Initial balance cents must be a non-negative safe integer.');
    }

    return new Account(props, id);
  }

  static reconstitute(props: AccountProps, id: string): Account {
    return new Account(props, id);
  }
}
