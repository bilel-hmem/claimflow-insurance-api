import { UnprocessableEntityException } from '@nestjs/common';
import { formatMillimes } from '../../../common/utils/money';
import { PolicyStatus } from '../../policies/policy.entity';

export interface PolicyTerms {
  status: PolicyStatus;
  startDate: string;
  endDate: string;
  coverageLimit: number;
}

/**
 * Underwriting checks for a new claim. Dates are YYYY-MM-DD strings, which
 * compare correctly as plain strings.
 */
export function assertClaimSubmittable(
  policy: PolicyTerms,
  incidentDate: string,
  amountClaimed: number,
  today: string,
): void {
  if (policy.status !== PolicyStatus.ACTIVE) {
    throw new UnprocessableEntityException('This policy is cancelled');
  }
  if (incidentDate > today) {
    throw new UnprocessableEntityException('The incident date cannot be in the future');
  }
  if (incidentDate < policy.startDate || incidentDate > policy.endDate) {
    throw new UnprocessableEntityException(
      `The incident date must be within the policy period (${policy.startDate} to ${policy.endDate})`,
    );
  }
  if (amountClaimed > policy.coverageLimit) {
    throw new UnprocessableEntityException(
      `The amount claimed exceeds the coverage limit of ${formatMillimes(policy.coverageLimit)}`,
    );
  }
}

/** An approved amount can be lower than requested (partial approval), never higher. */
export function assertApprovedAmount(
  amountApproved: number,
  amountClaimed: number,
  coverageLimit: number,
): void {
  if (amountApproved > amountClaimed) {
    throw new UnprocessableEntityException(
      'The approved amount cannot be higher than the amount claimed',
    );
  }
  if (amountApproved > coverageLimit) {
    throw new UnprocessableEntityException(
      'The approved amount cannot be higher than the coverage limit',
    );
  }
}
