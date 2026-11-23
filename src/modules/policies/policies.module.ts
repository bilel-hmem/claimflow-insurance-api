import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { Policy } from './policy.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Policy, User])],
  controllers: [PoliciesController],
  providers: [PoliciesService],
  exports: [TypeOrmModule],
})
export class PoliciesModule {}
