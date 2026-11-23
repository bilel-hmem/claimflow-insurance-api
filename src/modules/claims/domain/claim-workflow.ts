import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Role } from '../../../common/enums/role.enum';
import { ClaimStatus } from '../entities/claim-status.enum';

/**
 * The whole claim lifecycle in one table: for each status, which statuses it can move to,
 * and which role may make that move. Anything not listed here is impossible.
 *
 *   SUBMITTED ──(adjuster)──▶ UNDER_REVIEW ──(adjuster)──▶ APPROVED ──(admin)──▶ PAID
 *       │                          └──────(adjuster)──▶ REJECTED
 *       └──(policyholder)──▶ WITHDRAWN
 */
export const CLAIM_TRANSITIONS: Readonly<
  Record<ClaimStatus, Readonly<Partial<Record<ClaimStatus, readonly Role[]>>>>
> = {
  [ClaimStatus.SUBMITTED]: {
    [ClaimStatus.UNDER_REVIEW]: [Role.ADJUSTER],
    [ClaimStatus.WITHDRAWN]: [Role.POLICYHOLDER],
  },
  [ClaimStatus.UNDER_REVIEW]: {
    [ClaimStatus.APPROVED]: [Role.ADJUSTER],
    [ClaimStatus.REJECTED]: [Role.ADJUSTER],
  },
  [ClaimStatus.APPROVED]: {
    [ClaimStatus.PAID]: [Role.ADMIN],
  },
  [ClaimStatus.REJECTED]: {},
  [ClaimStatus.PAID]: {},
  [ClaimStatus.WITHDRAWN]: {},
};

export const FINAL_STATUSES: readonly ClaimStatus[] = [
  ClaimStatus.REJECTED,
  ClaimStatus.PAID,
  ClaimStatus.WITHDRAWN,
];

export function isFinal(status: ClaimStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

/** Statuses this role can move the claim to next (shown to clients as available actions). */
export function nextStatusesFor(status: ClaimStatus, role: Role): ClaimStatus[] {
  return (Object.entries(CLAIM_TRANSITIONS[status]) as [ClaimStatus, readonly Role[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([next]) => next);
}

/**
 * 409 when the move does not exist at all (e.g. PAID -> SUBMITTED),
 * 403 when it exists but this role is not allowed to make it.
 */
export function assertTransition(from: ClaimStatus, to: ClaimStatus, role: Role): void {
  const allowedRoles = CLAIM_TRANSITIONS[from][to];
  if (!allowedRoles) {
    throw new ConflictException(`A claim cannot move from ${from} to ${to}`);
  }
  if (!allowedRoles.includes(role)) {
    throw new ForbiddenException(`Only ${allowedRoles.join(' or ')} can move a claim to ${to}`);
  }
}
