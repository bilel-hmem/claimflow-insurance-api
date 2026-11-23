import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { UserView } from '../users/user.view';
import { AuthService, LoginResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Create a policyholder account. Staff accounts (adjusters, admins) are created by an admin. */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<UserView> {
    return this.auth.register(dto);
  }

  /** Exchange email + password for a JWT access token. Limited to 10 attempts per minute. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.auth.login(dto);
  }

  /** Current user's profile. */
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<UserView> {
    return this.auth.me(user.id);
  }
}
