import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Claim } from './claim.entity';
import { ClaimStatus } from './claim-status.enum';

/** Append-only audit trail: one row per status change, never updated or deleted. */
@Entity('claim_status_history')
@Index('IDX_claim_history_claim_changed', ['claimId', 'changedAt'])
@Index('IDX_claim_history_changed_by', ['changedById'])
export class ClaimStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'claim_id' })
  claimId: number;

  @ManyToOne(() => Claim, (claim) => claim.history)
  @JoinColumn({ name: 'claim_id', foreignKeyConstraintName: 'FK_claim_history_claim' })
  claim?: Claim;

  /** NULL for the initial submission. */
  @Column({ name: 'from_status', type: 'enum', enum: ClaimStatus, nullable: true })
  fromStatus: ClaimStatus | null;

  @Column({ name: 'to_status', type: 'enum', enum: ClaimStatus })
  toStatus: ClaimStatus;

  @Column({ name: 'changed_by' })
  changedById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by', foreignKeyConstraintName: 'FK_claim_history_user' })
  changedBy?: User;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}
