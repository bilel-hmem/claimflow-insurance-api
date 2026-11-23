import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Policy } from '../policies/policy.entity';
import { User } from '../users/user.entity';
import { ClaimDocumentsService } from './claim-documents.service';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { ClaimDocument } from './entities/claim-document.entity';
import { ClaimStatusHistory } from './entities/claim-status-history.entity';
import { Claim } from './entities/claim.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Claim, ClaimDocument, ClaimStatusHistory, Policy, User])],
  controllers: [ClaimsController],
  providers: [ClaimsService, ClaimDocumentsService],
})
export class ClaimsModule {}
