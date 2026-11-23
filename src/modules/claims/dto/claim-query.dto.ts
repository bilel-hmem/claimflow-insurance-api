import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PolicyType } from '../../policies/policy.entity';
import { ClaimStatus } from '../entities/claim-status.enum';

export class ClaimQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  /** Policy type */
  @IsOptional()
  @IsEnum(PolicyType)
  type?: PolicyType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  policyId?: number;

  /** Admin only: claims assigned to this adjuster */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adjusterId?: number;

  /** Admin only: claims waiting for an adjuster */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unassigned?: boolean;

  /** Submitted on or after (ISO 8601) */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Submitted on or before (ISO 8601) */
  @IsOptional()
  @IsDateString()
  to?: string;
}
