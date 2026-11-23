import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';
import { trim } from '../../../common/utils/transformers';

export class SubmitClaimDto {
  /** One of your active policies @example 1 */
  @IsInt()
  @Min(1)
  policyId: number;

  /** YYYY-MM-DD, within the policy period and not in the future @example "2026-11-20" */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'incidentDate must be a date in YYYY-MM-DD format' })
  incidentDate: string;

  /** What happened (20-2000 characters) @example "Rear-ended at a red light on Avenue Habib Bourguiba; rear bumper and trunk damaged." */
  @Transform(trim)
  @IsString()
  @Length(20, 2000)
  description: string;

  /** Amount requested in millimes (1 TND = 1000) @example 1850000 */
  @IsInt()
  @Min(1_000)
  @Max(10_000_000_000)
  amountClaimed: number;
}
