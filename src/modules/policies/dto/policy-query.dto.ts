import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PolicyStatus, PolicyType } from '../policy.entity';

export class PolicyQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PolicyType)
  type?: PolicyType;

  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus;
}
