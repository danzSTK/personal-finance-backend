import { UserStatus } from '../../../common/models/enums/user-status.enum';
import { Account } from '../../../entities/account.entity';
import { AuthProvider } from '../../auth/entities/auth-provider.entity';
import { Category } from '../../../entities/category.entity';
import { Transaction } from '../../../entities/transaction.entity';
import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Check,
  Unique,
} from 'typeorm';

@Entity('users')
@Index('idx_users_status', ['status'])
@Index('idx_users_email', ['email'], { unique: true })
@Check('CHK_users_status', `"status" IN ('PENDING_PROFILE', 'ACTIVE', 'BLOCKED')`)
@Unique('UQ_user_name', ['userName'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  email: string;

  @Column({
    name: 'user_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  userName: string | null;

  @Column({
    name: 'first_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  firstName: string | null;

  @Column({
    name: 'last_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  lastName: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: UserStatus.PENDING_PROFILE,
  })
  status: UserStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => Account, account => account.user)
  accounts: Account[];

  @OneToMany(() => Category, category => category.user)
  categories: Category[];

  @OneToMany(() => Transaction, transaction => transaction.user)
  transactions: Transaction[];

  @OneToMany(() => AuthProvider, authProvider => authProvider.user)
  authProviders: AuthProvider[];
}
