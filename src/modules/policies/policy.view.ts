import { formatMillimes } from '../../common/utils/money';
import { toUserSummary, UserSummary } from '../users/user.view';
import { Policy, PolicyStatus, PolicyType } from './policy.entity';

export interface PolicyView {
  id: number;
  policyNumber: string;
  type: PolicyType;
  status: PolicyStatus;
  coverageLimit: number;
  coverageLimitFormatted: string;
  startDate: string;
  endDate: string;
  holder: UserSummary | null;
  createdAt: Date;
}

export function toPolicyView(policy: Policy): PolicyView {
  return {
    id: policy.id,
    policyNumber: policy.policyNumber,
    type: policy.type,
    status: policy.status,
    coverageLimit: policy.coverageLimit,
    coverageLimitFormatted: formatMillimes(policy.coverageLimit),
    startDate: policy.startDate,
    endDate: policy.endDate,
    holder: toUserSummary(policy.holder),
    createdAt: policy.createdAt,
  };
}
