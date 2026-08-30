import {
  ACCOUNT_ICON_KEY_MAX_LENGTH,
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_NAME_MIN_LENGTH,
  isIconKey,
} from '@/common/models/constants';
import { AccountType, IconKey } from '@/common/models/enums';
import {
  AccountArchivedMutationError,
  AccountCannotBeArchivedError,
  AccountCannotBeDefaultError,
  InvalidAccountError,
  InvalidAccountNameError,
} from '@/modules/accounts/domain/errors';
import {
  AccountTemplateColorToken,
  AccountTemplateColorTokenValue,
} from '@/modules/accounts/domain/value-objects/account-template-color-token.value-object';
import { AggregateRoot } from '@/shared/domain/aggregate-root';

export interface AccountProps {
  userId: string;
  name: string;
  type: AccountType;
  initialBalanceCents: number;
  templateId: string | null;
  /**
   * @deprecated Projeção de compatibilidade da DB-COMPAT-002. Não usar como fonte da identidade visual.
   * Remover somente no contract da v0.5.
   */
  color: AccountTemplateColorTokenValue | null;
  /**
   * @deprecated Projeção de compatibilidade da DB-COMPAT-002. Não usar como fonte da identidade visual.
   * Remover somente no contract da v0.5.
   */
  icon: IconKey | null;
  includeInTotal: boolean;
  isArchived: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Account extends AggregateRoot {
  private constructor(
    private readonly props: AccountProps,
    public readonly id: string,
  ) {
    super();
  }

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

  get templateId(): string | null {
    return this.props.templateId;
  }

  /**
   * @deprecated Projeção de compatibilidade da DB-COMPAT-002. Use `templateId` e carregue o template associado.
   */
  get color(): AccountTemplateColorTokenValue | null {
    return this.props.color;
  }

  /**
   * @deprecated Projeção de compatibilidade da DB-COMPAT-002. Use `templateId` e carregue o template associado.
   */
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

  /**
   * @deprecated Compatibilidade com writers v0.3. Não criar regra nova baseada em `accounts.color`.
   */
  changerColor(color: AccountTemplateColorTokenValue | null) {
    if (this.props.color === color) {
      return;
    }

    if (this.props.isArchived) {
      throw new AccountArchivedMutationError('Cannot change color of an archived account.');
    }

    if (color) {
      AccountTemplateColorToken.create(color);
    }

    this.props.color = color;
    this.props.updatedAt = new Date();
  }

  changeTemplate(
    templateId: string,
    /**
     * @deprecated Projeção obrigatória durante DB-COMPAT-002; remover no contract da v0.5.
     */
    legacyColor: AccountTemplateColorTokenValue | null,
    /**
     * @deprecated Projeção obrigatória durante DB-COMPAT-002; remover no contract da v0.5.
     */
    legacyIcon: IconKey | null,
  ): void {
    if (this.props.isArchived) {
      throw new AccountArchivedMutationError('Cannot change template of an archived account.');
    }

    if (templateId.trim() === '') {
      throw new InvalidAccountError('Invalid account template id.');
    }

    if (legacyColor !== null) {
      AccountTemplateColorToken.create(legacyColor);
    }

    if (legacyIcon !== null && !isIconKey(legacyIcon)) {
      throw new InvalidAccountError('Invalid account icon.');
    }

    if (this.props.templateId === templateId && this.props.color === legacyColor && this.props.icon === legacyIcon) {
      return;
    }

    this.props.templateId = templateId;
    this.props.color = legacyColor;
    this.props.icon = legacyIcon;
    this.props.updatedAt = new Date();
  }

  associateTemplateForMigration(templateId: string): void {
    if (this.props.templateId !== null) {
      return;
    }

    if (templateId.trim() === '') {
      throw new InvalidAccountError('Invalid account template id.');
    }

    this.props.templateId = templateId;
    this.props.updatedAt = new Date();
  }

  /**
   * @deprecated Compatibilidade com writers v0.3. Não criar regra nova baseada em `accounts.icon`.
   */
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
