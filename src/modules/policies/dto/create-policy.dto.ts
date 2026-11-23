import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, Matches, Max, Min } from 'class-validator';
import { trimLower } from '../../../common/utils/transformers';
import { PolicyType } from '../policy.entity';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePolicyDto {
  /** The policyholder's account email. @example "amira@claimflow.tn" */
  @Transform(trimLower)
  @IsEmail()
  holderEmail: string;

  /** @example "AUTO" */
  @IsEnum(PolicyType)
  type: PolicyType;

  /**
   * Maximum payout per claim, in millimes (100 TND to 10,000,000 TND).
   * @example 20000000
   */
  @IsInt()
  @Min(100_000)
  @Max(10_000_000_000)
  coverageLimit: number;

  /** YYYY-MM-DD @example "2026-01-01" */
  @Matches(ISO_DATE, { message: 'startDate must be a date in YYYY-MM-DD format' })
  startDate: string;

  /** YYYY-MM-DD, after startDate @example "2026-12-31" */
  @Matches(ISO_DATE, { message: 'endDate must be a date in YYYY-MM-DD format' })
  endDate: string;
}
