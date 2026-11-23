import { UnprocessableEntityException } from '@nestjs/common';
import { PolicyStatus } from '../../policies/policy.entity';
import { assertApprovedAmount, assertClaimSubmittable, PolicyTerms } from './claim-rules';

describe('assertClaimSubmittable', () => {
  const policy: PolicyTerms = {
    status: PolicyStatus.ACTIVE,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    coverageLimit: 5_000_000, // 5,000 TND
  };
  const today = '2026-11-23';

  it('accepts a claim inside the policy period and under the limit', () => {
    expect(() => assertClaimSubmittable(policy, '2026-11-20', 1_200_000, today)).not.toThrow();
  });

  it('accepts the first and last day of the policy and the exact limit', () => {
    expect(() => assertClaimSubmittable(policy, '2026-01-01', 5_000_000, today)).not.toThrow();
    expect(() => assertClaimSubmittable(policy, '2026-12-31', 1_000, '2027-01-05')).not.toThrow();
  });

  it.each<[string, Partial<PolicyTerms>, string, number, string]>([
    ['a cancelled policy', { status: PolicyStatus.CANCELLED }, '2026-11-20', 1_000, 'cancelled'],
    ['an incident in the future', {}, '2026-11-24', 1_000, 'cannot be in the future'],
    ['an incident before the policy started', {}, '2025-12-31', 1_000, 'policy period'],
    [
      'an incident after the policy ended',
      { endDate: '2026-06-30' },
      '2026-07-01',
      1_000,
      'policy period',
    ],
    ['an amount above the coverage limit', {}, '2026-11-20', 5_000_001, '5000.000 TND'],
  ])('rejects %s', (_case, override, incidentDate, amount, message) => {
    const run = () =>
      assertClaimSubmittable({ ...policy, ...override }, incidentDate, amount, today);
    expect(run).toThrow(UnprocessableEntityException);
    expect(run).toThrow(message);
  });
});

describe('assertApprovedAmount', () => {
  it('allows a partial approval', () => {
    expect(() => assertApprovedAmount(800_000, 1_000_000, 5_000_000)).not.toThrow();
  });

  it('refuses more than was claimed', () => {
    expect(() => assertApprovedAmount(1_000_001, 1_000_000, 5_000_000)).toThrow(
      'higher than the amount claimed',
    );
  });

  it('refuses more than the coverage limit', () => {
    expect(() => assertApprovedAmount(900_000, 1_000_000, 500_000)).toThrow(
      'higher than the coverage limit',
    );
  });
});
