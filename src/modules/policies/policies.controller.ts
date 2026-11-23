import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { Paginated } from '../../common/utils/paginate';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { PolicyQueryDto } from './dto/policy-query.dto';
import { PoliciesService } from './policies.service';
import { PolicyView } from './policy.view';

@ApiTags('Policies')
@ApiBearerAuth()
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  /** Issue a policy to an existing policyholder. */
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreatePolicyDto): Promise<PolicyView> {
    return this.policies.create(dto);
  }

  /** Your policies (policyholder) or all policies (staff). */
  @Get()
  list(
    @CurrentUser() actor: AuthUser,
    @Query() query: PolicyQueryDto,
  ): Promise<Paginated<PolicyView>> {
    return this.policies.list(actor, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PolicyView> {
    return this.policies.findOne(actor, id);
  }

  /** Cancel a policy: no new claims can be filed against it. */
  @Roles(Role.ADMIN)
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number): Promise<PolicyView> {
    return this.policies.cancel(id);
  }
}
