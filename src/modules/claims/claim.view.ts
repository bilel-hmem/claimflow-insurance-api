import { Role } from '../../common/enums/role.enum';
import { formatMillimes } from '../../common/utils/money';
import { PolicyType } from '../policies/policy.entity';
import { toUserSummary, UserSummary } from '../users/user.view';
import { nextStatusesFor } from './domain/claim-workflow';
import { ClaimDocument } from './entities/claim-document.entity';
import { ClaimStatus } from './entities/claim-status.enum';
import { ClaimStatusHistory } from './entities/claim-status-history.entity';
import { Claim } from './entities/claim.entity';

export interface ClaimView {
  id: number;
  claimNumber: string;
  status: ClaimStatus;
  incidentDate: string;
  description: string;
  amountClaimed: number;
  amountClaimedFormatted: string;
  amountApproved: number | null;
  amountApprovedFormatted: string | null;
  rejectionReason: string | null;
  policy: { id: number; policyNumber: string; type: PolicyType } | null;
  policyholder: UserSummary | null;
  adjuster: UserSummary | null;
  /** Statuses the current user may move this claim to (drives the buttons in a UI). */
  availableTransitions: ClaimStatus[];
  submittedAt: Date;
  closedAt: Date | null;
}

export interface TimelineEntry {
  fromStatus: ClaimStatus | null;
  toStatus: ClaimStatus;
  comment: string | null;
  changedBy: { id: number; fullName: string; role: Role } | null;
  changedAt: Date;
}

export interface DocumentView {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: UserSummary | null;
  uploadedAt: Date;
}

export function toClaimView(claim: Claim, viewerRole: Role): ClaimView {
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    status: claim.status,
    incidentDate: claim.incidentDate,
    description: claim.description,
    amountClaimed: claim.amountClaimed,
    amountClaimedFormatted: formatMillimes(claim.amountClaimed),
    amountApproved: claim.amountApproved,
    amountApprovedFormatted:
      claim.amountApproved === null ? null : formatMillimes(claim.amountApproved),
    rejectionReason: claim.rejectionReason,
    policy: claim.policy
      ? { id: claim.policy.id, policyNumber: claim.policy.policyNumber, type: claim.policy.type }
      : null,
    policyholder: toUserSummary(claim.policy?.holder),
    adjuster: toUserSummary(claim.assignedAdjuster),
    availableTransitions: nextStatusesFor(claim.status, viewerRole),
    submittedAt: claim.submittedAt,
    closedAt: claim.closedAt,
  };
}

export function toTimelineEntry(entry: ClaimStatusHistory): TimelineEntry {
  return {
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    comment: entry.comment,
    changedBy: entry.changedBy
      ? { id: entry.changedBy.id, fullName: entry.changedBy.fullName, role: entry.changedBy.role }
      : null,
    changedAt: entry.changedAt,
  };
}

export function toDocumentView(document: ClaimDocument): DocumentView {
  return {
    id: document.id,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    uploadedBy: toUserSummary(document.uploadedBy),
    uploadedAt: document.uploadedAt,
  };
}
