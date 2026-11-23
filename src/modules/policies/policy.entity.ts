import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../../common/utils/money';
import { User } from '../users/user.entity';

export enum PolicyType {
  AUTO = 'AUTO',
  HEALTH = 'HEALTH',
  HOME = 'HOME',
}

export enum PolicyStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

@Entity('policies')
@Index('UQ_policies_number', ['policyNumber'], { unique: true })
@Index('IDX_policies_holder', ['holderId'])
export class Policy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'policy_number', length: 24 })
  policyNumber: string;

  @Column({ name: 'holder_id' })
  holderId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'holder_id', foreignKeyConstraintName: 'FK_policies_holder' })
  holder?: User;

  @Column({ type: 'enum', enum: PolicyType })
  type: PolicyType;

  /** Maximum payout per claim, in millimes (1 TND = 1000). */
  @Column({ name: 'coverage_limit', type: 'bigint', transformer: bigintTransformer })
  coverageLimit: number;

  /** YYYY-MM-DD, inclusive */
  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  /** YYYY-MM-DD, inclusive */
  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'enum', enum: PolicyStatus, default: PolicyStatus.ACTIVE })
  status: PolicyStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
