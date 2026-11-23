import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { trim } from '../../../common/utils/transformers';
import { ClaimStatus } from '../entities/claim-status.enum';

export class ChangeClaimStatusDto {
  /** Target status. Allowed moves depend on the current status and your role. @example "UNDER_REVIEW" */
  @IsEnum(ClaimStatus)
  status: ClaimStatus;

  /** Required when approving: amount granted in millimes (may be less than claimed) @example 1500000 */
  @ValidateIf((dto: ChangeClaimStatusDto) => dto.status === ClaimStatus.APPROVED)
  @IsInt()
  @Min(1)
  amountApproved?: number;

  /** Required when rejecting: shown to the policyholder @example "Damage pre-dates the policy start date." */
  @ValidateIf((dto: ChangeClaimStatusDto) => dto.status === ClaimStatus.REJECTED)
  @Transform(trim)
  @IsString()
  @Length(5, 500)
  rejectionReason?: string;

  /** Optional note stored in the claim timeline */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  comment?: string;
}
