import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Role } from '../../../common/enums/role.enum';

export class UserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
