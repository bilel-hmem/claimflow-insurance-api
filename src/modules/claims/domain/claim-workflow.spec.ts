import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Role } from '../../../common/enums/role.enum';
import { ClaimStatus } from '../entities/claim-status.enum';
import { assertTransition, isFinal, nextStatusesFor } from './claim-workflow';

const { SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, PAID, WITHDRAWN } = ClaimStatus;
const { POLICYHOLDER, ADJUSTER, ADMIN } = Role;

/** The only allowed (from, to, role) combinations. Everything else must be refused. */
const ALLOWED: [ClaimStatus, ClaimStatus, Role][] = [
  [SUBMITTED, UNDER_REVIEW, ADJUSTER],
  [SUBMITTED, WITHDRAWN, POLICYHOLDER],
  [UNDER_REVIEW, APPROVED, ADJUSTER],
  [UNDER_REVIEW, REJECTED, ADJUSTER],
  [APPROVED, PAID, ADMIN],
];

const allStatuses = Object.values(ClaimStatus);
const allRoles = Object.values(Role);

describe('claim workflow', () => {
  it.each(ALLOWED)('allows %s -> %s for %s', (from, to, role) => {
    expect(() => assertTransition(from, to, role)).not.toThrow();
  });

  // Exhaustive: every status x status x role combination (6 x 6 x 3 = 108 cases).
  const everyCombination = allStatuses.flatMap((from) =>
    allStatuses.flatMap((to) => allRoles.map((role) => [from, to, role] as const)),
  );
  const refused = everyCombination.filter(
    ([from, to, role]) => !ALLOWED.some(([f, t, r]) => f === from && t === to && r === role),
  );

  it.each(refused)('refuses %s -> %s for %s', (from, to, role) => {
    expect(() => assertTransition(from, to, role)).toThrow();
  });

  it('answers 409 for a move that does not exist', () => {
    expect(() => assertTransition(PAID, SUBMITTED, ADMIN)).toThrow(ConflictException);
    expect(() => assertTransition(SUBMITTED, APPROVED, ADJUSTER)).toThrow(ConflictException);
  });

  it('answers 403 when the move exists but the role may not make it', () => {
    expect(() => assertTransition(UNDER_REVIEW, APPROVED, POLICYHOLDER)).toThrow(
      ForbiddenException,
    );
    expect(() => assertTransition(APPROVED, PAID, ADJUSTER)).toThrow(
      'Only ADMIN can move a claim to PAID',
    );
  });

  it('lists the next statuses available to each role', () => {
    expect(nextStatusesFor(SUBMITTED, ADJUSTER)).toEqual([UNDER_REVIEW]);
    expect(nextStatusesFor(SUBMITTED, POLICYHOLDER)).toEqual([WITHDRAWN]);
    expect(nextStatusesFor(UNDER_REVIEW, ADJUSTER)).toEqual([APPROVED, REJECTED]);
    expect(nextStatusesFor(PAID, ADMIN)).toEqual([]);
  });

  it.each([
    [REJECTED, true],
    [PAID, true],
    [WITHDRAWN, true],
    [SUBMITTED, false],
    [UNDER_REVIEW, false],
    [APPROVED, false],
  ])('isFinal(%s) is %s', (status, expected) => {
    expect(isFinal(status)).toBe(expected);
  });
});
