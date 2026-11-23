import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { todayIso } from '../../common/utils/date';
import { paginate, Paginated, skipFor } from '../../common/utils/paginate';
import { generateNumber } from '../../common/utils/reference';
import { Policy } from '../policies/policy.entity';
import { User } from '../users/user.entity';
import { ClaimView, TimelineEntry, toClaimView, toTimelineEntry } from './claim.view';
import { assertApprovedAmount, assertClaimSubmittable } from './domain/claim-rules';
import { assertTransition, isFinal } from './domain/claim-workflow';
import { ChangeClaimStatusDto } from './dto/change-status.dto';
import { ClaimQueryDto } from './dto/claim-query.dto';
import { SubmitClaimDto } from './dto/submit-claim.dto';
import { ClaimStatus } from './entities/claim-status.enum';
import { ClaimStatusHistory } from './entities/claim-status-history.entity';
import { Claim } from './entities/claim.entity';

@Injectable()
export class ClaimsService {
  constructor(
    @InjectRepository(Claim) private readonly claims: Repository<Claim>,
    @InjectRepository(Policy) private readonly policies: Repository<Policy>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ClaimStatusHistory)
    private readonly history: Repository<ClaimStatusHistory>,
    private readonly dataSource: DataSource,
  ) {}

  async submit(actor: AuthUser, dto: SubmitClaimDto): Promise<ClaimView> {
    const policy = await this.policies.findOne({ where: { id: dto.policyId } });
    if (!policy || policy.holderId !== actor.id) {
      throw new NotFoundException('Policy not found');
    }
    assertClaimSubmittable(policy, dto.incidentDate, dto.amountClaimed, todayIso());

    const claimId = await this.dataSource.transaction(async (manager) => {
      const claim = await manager.save(
        manager.create(Claim, {
          claimNumber: generateNumber('CLM'),
          policyId: policy.id,
          assignedAdjusterId: null,
          incidentDate: dto.incidentDate,
          description: dto.description,
          amountClaimed: dto.amountClaimed,
          amountApproved: null,
          status: ClaimStatus.SUBMITTED,
          rejectionReason: null,
          closedAt: null,
        }),
      );
      await manager.save(
        manager.create(ClaimStatusHistory, {
          claimId: claim.id,
          fromStatus: null,
          toStatus: ClaimStatus.SUBMITTED,
          changedById: actor.id,
          comment: 'Claim submitted',
        }),
      );
      return claim.id;
    });
    return this.findOne(actor, claimId);
  }

  async list(actor: AuthUser, query: ClaimQueryDto): Promise<Paginated<ClaimView>> {
    const qb = this.visibleClaims(actor);
    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.type) {
      qb.andWhere('p.type = :type', { type: query.type });
    }
    if (query.policyId) {
      qb.andWhere('c.policyId = :policyId', { policyId: query.policyId });
    }
    if (query.from) {
      qb.andWhere('c.submittedAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('c.submittedAt <= :to', { to: new Date(query.to) });
    }
    if (actor.role === Role.ADMIN && query.adjusterId) {
      qb.andWhere('c.assignedAdjusterId = :adjusterId', { adjusterId: query.adjusterId });
    }
    if (actor.role === Role.ADMIN && query.unassigned) {
      qb.andWhere('c.assignedAdjusterId IS NULL');
    }
    const [rows, total] = await qb
      .orderBy('c.submittedAt', query.order)
      .addOrderBy('c.id', query.order)
      .skip(skipFor(query.page, query.limit))
      .take(query.limit)
      .getManyAndCount();
    return paginate(
      rows.map((claim) => toClaimView(claim, actor.role)),
      total,
      query.page,
      query.limit,
    );
  }

  async findOne(actor: AuthUser, id: number): Promise<ClaimView> {
    return toClaimView(await this.getVisibleClaim(actor, id), actor.role);
  }

  /**
   * Loads a claim the user is allowed to see, or answers 404 (never 403, so the API
   * does not confirm that other people's claims exist).
   * Policyholders see their own claims, adjusters the claims assigned to them, admins all.
   */
  async getVisibleClaim(actor: AuthUser, id: number): Promise<Claim> {
    const claim = await this.visibleClaims(actor).andWhere('c.id = :id', { id }).getOne();
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }
    return claim;
  }

  async assign(admin: AuthUser, id: number, adjusterId: number): Promise<ClaimView> {
    const adjuster = await this.users.findOne({ where: { id: adjusterId } });
    if (!adjuster || adjuster.role !== Role.ADJUSTER) {
      throw new UnprocessableEntityException('This user is not a claims adjuster');
    }
    const claim = await this.claims.findOne({ where: { id } });
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }
    if (claim.status !== ClaimStatus.SUBMITTED && claim.status !== ClaimStatus.UNDER_REVIEW) {
      throw new ConflictException(`A ${claim.status} claim cannot be reassigned`);
    }
    await this.claims.update(id, { assignedAdjusterId: adjuster.id });
    return this.findOne(admin, id);
  }

  /**
   * Moves a claim through the workflow. The claim row is locked for the duration of the
   * change, so two adjusters clicking "approve" and "reject" at the same moment cannot
   * both succeed: the second one sees the new status and gets a 409.
   */
  async changeStatus(actor: AuthUser, id: number, dto: ChangeClaimStatusDto): Promise<ClaimView> {
    await this.dataSource.transaction(async (manager) => {
      const claim = await manager.findOne(Claim, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      const policy = claim
        ? await manager.findOne(Policy, { where: { id: claim.policyId } })
        : null;
      if (!claim || !policy || !canSee(actor, claim, policy)) {
        throw new NotFoundException('Claim not found');
      }

      assertTransition(claim.status, dto.status, actor.role);

      const changes: Partial<Claim> = { status: dto.status };
      if (dto.status === ClaimStatus.APPROVED) {
        if (dto.amountApproved === undefined) {
          throw new BadRequestException('amountApproved is required to approve a claim');
        }
        assertApprovedAmount(dto.amountApproved, claim.amountClaimed, policy.coverageLimit);
        changes.amountApproved = dto.amountApproved;
      }
      if (dto.status === ClaimStatus.REJECTED) {
        changes.rejectionReason = dto.rejectionReason ?? null;
      }
      if (isFinal(dto.status)) {
        changes.closedAt = new Date();
      }

      await manager.update(Claim, claim.id, changes);
      await manager.save(
        manager.create(ClaimStatusHistory, {
          claimId: claim.id,
          fromStatus: claim.status,
          toStatus: dto.status,
          changedById: actor.id,
          comment: dto.comment ?? dto.rejectionReason ?? null,
        }),
      );
    });
    return this.findOne(actor, id);
  }

  /** Full audit trail of a claim, oldest first. */
  async timeline(actor: AuthUser, id: number): Promise<TimelineEntry[]> {
    const claim = await this.getVisibleClaim(actor, id);
    const entries = await this.history.find({
      where: { claimId: claim.id },
      relations: { changedBy: true },
      order: { changedAt: 'ASC', id: 'ASC' },
    });
    return entries.map(toTimelineEntry);
  }

  private visibleClaims(actor: AuthUser): SelectQueryBuilder<Claim> {
    const qb = this.claims
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.policy', 'p')
      .innerJoinAndSelect('p.holder', 'h')
      .leftJoinAndSelect('c.assignedAdjuster', 'a')
      .where('1 = 1');
    if (actor.role === Role.POLICYHOLDER) {
      qb.andWhere('p.holderId = :actorId', { actorId: actor.id });
    } else if (actor.role === Role.ADJUSTER) {
      qb.andWhere('c.assignedAdjusterId = :actorId', { actorId: actor.id });
    }
    return qb;
  }
}

function canSee(actor: AuthUser, claim: Claim, policy: Policy): boolean {
  switch (actor.role) {
    case Role.ADMIN:
      return true;
    case Role.ADJUSTER:
      return claim.assignedAdjusterId === actor.id;
    case Role.POLICYHOLDER:
      return policy.holderId === actor.id;
    default:
      return false;
  }
}
