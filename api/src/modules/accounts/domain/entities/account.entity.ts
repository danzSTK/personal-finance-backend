import { ConflictException } from '@nestjs/common';
import { AccountType } from '@/common/models/enums/account-type.enum';

export interface AccountProps {
  userId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  color: string | null;
  icon: string | null;
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

  get initialBalance(): number {
    return this.props.initialBalance;
  }

  get color(): string | null {
    return this.props.color;
  }

  get icon(): string | null {
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

  archive(): void {
    if (this.props.isDefault) {
      throw new ConflictException('Default account cannot be archived');
    }

    this.props.isArchived = true;
    this.props.updatedAt = new Date();
  }

  setAsDefault(): void {
    if (this.props.isArchived) {
      throw new ConflictException('Archived account cannot be set as default');
    }

    this.props.isDefault = true;
    this.props.updatedAt = new Date();
  }

  unsetAsDefault(): void {
    this.props.isDefault = false;
    this.props.updatedAt = new Date();
  }

  static create(props: AccountProps, id: string): Account {
    return new Account(props, id);
  }

  static reconstitute(props: AccountProps, id: string): Account {
    return new Account(props, id);
  }
}
