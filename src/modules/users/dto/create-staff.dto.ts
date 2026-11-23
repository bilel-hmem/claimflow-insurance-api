import { IsIn } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';
import { RegisterDto } from '../../auth/dto/register.dto';

export class CreateStaffDto extends RegisterDto {
  /** @example "ADJUSTER" */
  @IsIn([Role.ADJUSTER, Role.ADMIN])
  role: Role.ADJUSTER | Role.ADMIN;
}
