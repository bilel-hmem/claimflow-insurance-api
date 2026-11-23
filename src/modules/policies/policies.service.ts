import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { paginate, Paginated, skipFor } from '../../common/utils/paginate';
import { generateNumber } from '../../common/utils/reference';
import { User } from '../users/user.entity';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { PolicyQueryDto } from './dto/policy-query.dto';
import { Policy, PolicyStatus } from './policy.entity';
import { PolicyView, toPolicyView } from './policy.view';

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(Policy) private readonly policies: Repository<Policy>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(dto: CreatePolicyDto): Promise<PolicyView> {
    if (dto.endDate <= dto.startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }
    const holder = await this.users.findOne({ where: { email: dto.holderEmail } });
    if (!holder || holder.role !== Role.POLICYHOLDER) {
      throw new UnprocessableEntityException('No policyholder account with this email');
    }
    const policy = await this.policies.save(
      this.policies.create({
        policyNumber: generateNumber('POL'),
        holderId: holder.id,
        type: dto.type,
        coverageLimit: dto.coverageLimit,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: PolicyStatus.ACTIVE,
      }),
    );
    policy.holder = holder;
    return toPolicyView(policy);
  }

  /** Policyholders only see their own policies; staff see all of them. */
  async list(actor: AuthUser, query: PolicyQueryDto): Promise<Paginated<PolicyView>> {
    const qb = this.policies.createQueryBuilder('p').leftJoinAndSelect('p.holder', 'h');
    if (actor.role === Role.POLICYHOLDER) {
      qb.andWhere('p.holderId = :holderId', { holderId: actor.id });
    }
    if (query.type) {
      qb.andWhere('p.type = :type', { type: query.type });
    }
    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    const [rows, total] = await qb
      .orderBy('p.createdAt', query.order)
      .addOrderBy('p.id', query.order)
      .skip(skipFor(query.page, query.limit))
      .take(query.limit)
      .getManyAndCount();
    return paginate(rows.map(toPolicyView), total, query.page, query.limit);
  }

  async findOne(actor: AuthUser, id: number): Promise<PolicyView> {
    const policy = await this.policies.findOne({ where: { id }, relations: { holder: true } });
    // 404 rather than 403: never confirm that someone else's policy exists.
    if (!policy || (actor.role === Role.POLICYHOLDER && policy.holderId !== actor.id)) {
      throw new NotFoundException('Policy not found');
    }
    return toPolicyView(policy);
  }

  async cancel(id: number): Promise<PolicyView> {
    const policy = await this.policies.findOne({ where: { id }, relations: { holder: true } });
    if (!policy) {
      throw new NotFoundException('Policy not found');
    }
    if (policy.status === PolicyStatus.CANCELLED) {
      throw new ConflictException('Policy is already cancelled');
    }
    await this.policies.update(policy.id, { status: PolicyStatus.CANCELLED });
    policy.status = PolicyStatus.CANCELLED;
    return toPolicyView(policy);
  }
}
