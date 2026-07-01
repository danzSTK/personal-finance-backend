import {
  EmailVerificationChallengeLimits,
  EmailVerificationPurpose,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { USER_EMAIL_MAX_LENGTH } from '@/common/models/constants';
import { UserOrmEntity } from '@/modules/users/infrastructure/persistence/user-orm-entity';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('email_verification_challenges')
@Index('idx_email_verification_challenges_token', ['purpose', 'tokenHash'])
@Index('idx_email_verification_challenges_email_purpose_created_at', ['email', 'purpose', 'createdAt'])
@Index('idx_email_verification_challenges_user_purpose_created_at', ['userId', 'purpose', 'createdAt'])
@Index('idx_email_verification_challenges_unconsumed_expiration', ['purpose', 'expiresAt'], {
  where: '"consumed_at" IS NULL',
})
@Check('CHK_email_verification_challenges_purpose', `"purpose" IN ('EMAIL_VERIFICATION')`)
@Check('CHK_email_verification_challenges_token_hash_length', `length("token_hash") = 64`)
@Check('CHK_email_verification_challenges_expiration', `"expires_at" > "created_at"`)
@Check(
  'CHK_email_verification_challenges_consumed_after_created',
  `"consumed_at" IS NULL OR "consumed_at" >= "created_at"`,
)
export class EmailVerificationChallengeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: USER_EMAIL_MAX_LENGTH })
  email!: string;

  @Column({ type: 'varchar', length: EmailVerificationChallengeLimits.purposeMaxLength })
  purpose!: EmailVerificationPurpose;

  @Column({ name: 'token_hash', type: 'varchar', length: EmailVerificationChallengeLimits.tokenHashLength })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_email_verification_challenges_user' })
  user!: UserOrmEntity;
}
