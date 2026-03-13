import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { AuthProviderType } from '../../../../common/models/enums';
import { UserOrmEntity } from './user-orm-entity';

@Entity('auth_providers')
@Unique('UQ_auth_providers', ['provider', 'providerUserId'])
@Index('idx_auth_providers_user_id', ['user_id'])
export class AuthProviderOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  provider: AuthProviderType;

  @Column({
    name: 'provider_user_id',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  providerUserId: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  passwordHash: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => UserOrmEntity, user => user.authProviders, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_auth_providers_user',
  })
  user: UserOrmEntity;
}
