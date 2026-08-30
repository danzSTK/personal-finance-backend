import { ACCOUNT_ICON_KEY_MAX_LENGTH, isColorToken, isIconKey } from '@/common/models/constants';
import { IconKey } from '@/common/models/enums';
import { InvalidAccountTemplateError } from '@/modules/accounts/domain/errors';
import { ACCOUNT_TEMPLATE_TYPE, AccountTemplateType } from '@/modules/accounts/domain/enums/account-template-type.enum';
import {
  AccountTemplateColorToken,
  AccountTemplateColorTokenValue,
  isInstitutionalAccountTemplateColorToken,
} from '@/modules/accounts/domain/value-objects/account-template-color-token.value-object';
import { AccountTemplateStorageKey } from '@/modules/accounts/domain/value-objects/account-template-storage-key.value-object';
import { AggregateRoot } from '@/shared/domain/aggregate-root';

const ACCOUNT_TEMPLATE_NAME_MAX_LENGTH = 255;
const ACCOUNT_TEMPLATE_CATALOG_KEY_MAX_LENGTH = 80;

export interface AccountTemplateProps {
  type: AccountTemplateType;
  ownerUserId: string | null;
  catalogKey: string | null;
  name: string;
  colorToken: AccountTemplateColorTokenValue | null;
  iconKey: IconKey | null;
  logoStorageKey: string | null;
  bankCode: number | null;
  ispb: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateCustomVisualIdentityInput {
  ownerUserId: string;
  name: string;
  colorToken: AccountTemplateColorTokenValue | null;
  iconKey: IconKey | null;
}

export class AccountTemplate extends AggregateRoot {
  private constructor(
    private readonly props: AccountTemplateProps,
    public readonly id: string,
  ) {
    super();
  }

  get type(): AccountTemplateType {
    return this.props.type;
  }

  get ownerUserId(): string | null {
    return this.props.ownerUserId;
  }

  get catalogKey(): string | null {
    return this.props.catalogKey;
  }

  get name(): string {
    return this.props.name;
  }

  get colorToken(): AccountTemplateColorTokenValue | null {
    return this.props.colorToken;
  }

  get iconKey(): IconKey | null {
    return this.props.iconKey;
  }

  get logoStorageKey(): string | null {
    return this.props.logoStorageKey;
  }

  get bankCode(): number | null {
    return this.props.bankCode;
  }

  get ispb(): string | null {
    return this.props.ispb;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateCustomVisualIdentity(input: UpdateCustomVisualIdentityInput): void {
    if (this.props.type !== ACCOUNT_TEMPLATE_TYPE.CUSTOM || this.props.ownerUserId !== input.ownerUserId) {
      throw new InvalidAccountTemplateError('Only the owner can update a custom account template.');
    }

    AccountTemplate.validateName(input.name);

    if (input.colorToken !== null && !isColorToken(input.colorToken)) {
      throw new InvalidAccountTemplateError('Custom account templates require an application color token.');
    }

    if (input.iconKey !== null && !isIconKey(input.iconKey)) {
      throw new InvalidAccountTemplateError('Invalid custom account template icon key.');
    }

    this.props.name = input.name;
    this.props.colorToken = input.colorToken;
    this.props.iconKey = input.iconKey;
    this.props.updatedAt = new Date();
  }

  static create(props: AccountTemplateProps, id: string): AccountTemplate {
    AccountTemplate.validate(props);
    return new AccountTemplate({ ...props }, id);
  }

  static reconstitute(props: AccountTemplateProps, id: string): AccountTemplate {
    return new AccountTemplate({ ...props }, id);
  }

  private static validate(props: AccountTemplateProps): void {
    AccountTemplate.validateName(props.name);

    if (props.colorToken !== null) {
      AccountTemplateColorToken.create(props.colorToken);
    }

    if (props.iconKey !== null && (props.iconKey.length > ACCOUNT_ICON_KEY_MAX_LENGTH || !isIconKey(props.iconKey))) {
      throw new InvalidAccountTemplateError('Invalid account template icon key.');
    }

    if (props.type === ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL) {
      AccountTemplate.validateInstitutional(props);
      return;
    }

    AccountTemplate.validateCustom(props);
  }

  private static validateInstitutional(props: AccountTemplateProps): void {
    if (props.ownerUserId !== null) {
      throw new InvalidAccountTemplateError('Institutional account templates cannot have an owner.');
    }

    if (
      props.catalogKey === null ||
      props.catalogKey.trim() === '' ||
      props.catalogKey.length > ACCOUNT_TEMPLATE_CATALOG_KEY_MAX_LENGTH
    ) {
      throw new InvalidAccountTemplateError('Institutional account templates require a valid catalog key.');
    }

    if (props.colorToken === null || !isInstitutionalAccountTemplateColorToken(props.colorToken)) {
      throw new InvalidAccountTemplateError('Institutional account templates require an institutional color token.');
    }

    if (props.iconKey !== null || props.logoStorageKey === null) {
      throw new InvalidAccountTemplateError(
        'Institutional account templates require a logo and cannot have an icon key.',
      );
    }

    AccountTemplateStorageKey.create(props.logoStorageKey);

    if (!Number.isInteger(props.bankCode) || props.bankCode === null || props.bankCode < 1 || props.bankCode > 999) {
      throw new InvalidAccountTemplateError('Institutional account templates require a valid bank code.');
    }

    if (props.ispb === null || !/^\d{8}$/.test(props.ispb)) {
      throw new InvalidAccountTemplateError('Institutional account templates require an eight-digit ISPB.');
    }
  }

  private static validateCustom(props: AccountTemplateProps): void {
    if (props.ownerUserId === null || props.ownerUserId.trim() === '') {
      throw new InvalidAccountTemplateError('Custom account templates require an owner.');
    }

    if (props.catalogKey !== null || props.logoStorageKey !== null || props.bankCode !== null || props.ispb !== null) {
      throw new InvalidAccountTemplateError('Custom account templates cannot contain institutional metadata.');
    }

    if (props.colorToken !== null && !isColorToken(props.colorToken)) {
      throw new InvalidAccountTemplateError('Custom account templates require an application color token.');
    }
  }

  private static validateName(name: string): void {
    if (name.trim() === '' || name.length > ACCOUNT_TEMPLATE_NAME_MAX_LENGTH) {
      throw new InvalidAccountTemplateError('Invalid account template name.');
    }
  }
}
