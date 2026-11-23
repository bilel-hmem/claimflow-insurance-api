import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimLower } from '../../../common/utils/transformers';

export class LoginDto {
  /** @example "amira@claimflow.tn" */
  @Transform(trimLower)
  @IsEmail()
  email: string;

  /** @example "Passw0rd!" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
