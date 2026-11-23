import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ClaimsSummary, ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Claims per status, amounts claimed/approved/paid and average processing time. */
  @Get('claims-summary')
  claimsSummary(): Promise<ClaimsSummary> {
    return this.reports.claimsSummary();
  }
}
