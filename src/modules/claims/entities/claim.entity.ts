import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/utils/money';
import { Policy } from '../../policies/policy.entity';
import { User } from '../../users/user.entity';
import { ClaimDocument } from './claim-document.entity';
import { ClaimStatus } from './claim-status.enum';
import { ClaimStatusHistory } from './claim-status-history.entity';

export { ClaimStatus };

@Entity('claims')
@Index('UQ_claims_number', ['claimNumber'], { unique: true })
@Index('IDX_claims_policy', ['policyId'])
@Index('IDX_claims_adjuster_status', ['assignedAdjusterId', 'status'])
@Index('IDX_claims_status_submitted', ['status', 'submittedAt'])
export class Claim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'claim_number', length: 24 })
  claimNumber: string;

  @Column({ name: 'policy_id' })
  policyId: number;

  @ManyToOne(() => Policy)
  @JoinColumn({ name: 'policy_id', foreignKeyConstraintName: 'FK_claims_policy' })
  policy?: Policy;

  @Column({ name: 'assigned_adjuster_id', type: 'int', nullable: true })
  assignedAdjusterId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_adjuster_id', foreignKeyConstraintName: 'FK_claims_adjuster' })
  assignedAdjuster?: User | null;

  /** YYYY-MM-DD */
  @Column({ name: 'incident_date', type: 'date' })
  incidentDate: string;

  @Column({ type: 'text' })
  description: string;

  /** Millimes */
  @Column({ name: 'amount_claimed', type: 'bigint', transformer: bigintTransformer })
  amountClaimed: number;

  /** Millimes, set when the claim is approved */
  @Column({
    name: 'amount_approved',
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  amountApproved: number | null;

  @Column({ type: 'enum', enum: ClaimStatus, default: ClaimStatus.SUBMITTED })
  status: ClaimStatus;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  /** Set when the claim reaches a final status (REJECTED, PAID, WITHDRAWN). */
  @Column({ name: 'closed_at', type: 'datetime', precision: 6, nullable: true })
  closedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ClaimDocument, (document) => document.claim)
  documents?: ClaimDocument[];

  @OneToMany(() => ClaimStatusHistory, (entry) => entry.claim)
  history?: ClaimStatusHistory[];
}
