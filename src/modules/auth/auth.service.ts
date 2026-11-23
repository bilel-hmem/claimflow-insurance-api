import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/auth-user.interface';
import { User } from '../users/user.entity';
import { toUserView, UserView } from '../users/user.view';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly bcryptRounds: number;
  private readonly expiresIn: number;
  /** Compared against when the email is unknown, so both failure paths take the same time. */
  private readonly dummyHash: string;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.bcryptRounds = config.get<number>('BCRYPT_ROUNDS', 10);
    this.expiresIn = config.get<number>('JWT_EXPIRES_IN_SECONDS', 3600);
    this.dummyHash = bcrypt.hashSync('timing-attack-protection', this.bcryptRounds);
  }

  /** Public sign-up always creates a POLICYHOLDER. Staff accounts are created by an admin. */
  register(dto: RegisterDto): Promise<UserView> {
    return this.createUser(dto, Role.POLICYHOLDER);
  }

  async createUser(dto: RegisterDto, role: Role): Promise<UserView> {
    if (await this.users.existsBy({ email: dto.email })) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
    const user = await this.users.save(
      this.users.create({ fullName: dto.fullName, email: dto.email, passwordHash, role }),
    );
    return toUserView(user);
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.users.findOne({
      where: { email: dto.email },
      select: { id: true, email: true, role: true, passwordHash: true },
    });
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
    };
  }

  async me(userId: number): Promise<UserView> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUserView(user);
  }
}
