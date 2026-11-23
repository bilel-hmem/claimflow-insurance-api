import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { paginate, Paginated, skipFor } from '../../common/utils/paginate';
import { AuthService } from '../auth/auth.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User } from './user.entity';
import { toUserView, UserView } from './user.view';

@ApiTags('Users (admin)')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Create a staff account (claims adjuster or admin). */
  @Post()
  create(@Body() dto: CreateStaffDto): Promise<UserView> {
    return this.auth.createUser(dto, dto.role);
  }

  /** List users, e.g. `?role=ADJUSTER` to pick someone to assign a claim to. */
  @Get()
  async list(@Query() query: UserQueryDto): Promise<Paginated<UserView>> {
    const [users, total] = await this.users.findAndCount({
      where: query.role ? { role: query.role } : {},
      order: { createdAt: query.order, id: query.order },
      skip: skipFor(query.page, query.limit),
      take: query.limit,
    });
    return paginate(users.map(toUserView), total, query.page, query.limit);
  }
}
