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

@Entity('claim_documents')
@Index('IDX_claim_documents_claim', ['claimId'])
@Index('IDX_claim_documents_uploaded_by', ['uploadedById'])
@Index('UQ_claim_documents_stored_name', ['storedName'], { unique: true })
export class ClaimDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'claim_id' })
  claimId: number;

  @ManyToOne(() => Claim, (claim) => claim.documents)
  @JoinColumn({ name: 'claim_id', foreignKeyConstraintName: 'FK_claim_documents_claim' })
  claim?: Claim;

  /** File name as sent by the client (display only, never used as a path). */
  @Column({ name: 'original_name', length: 255 })
  originalName: string;

  /** Random UUID-based name on disk, so user input never reaches the file system path. */
  @Column({ name: 'stored_name', length: 64 })
  storedName: string;

  /** Detected from the file's content (magic bytes), not from the client's header. */
  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes' })
  sizeBytes: number;

  @Column({ name: 'uploaded_by' })
  uploadedById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by', foreignKeyConstraintName: 'FK_claim_documents_uploader' })
  uploadedBy?: User;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}
