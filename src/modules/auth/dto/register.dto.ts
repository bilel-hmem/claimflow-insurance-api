import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { trim, trimLower } from '../../../common/utils/transformers';

export class RegisterDto {
  /** @example "Amira Haddad" */
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  fullName: string;

  /** @example "amira@claimflow.tn" */
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(180)
  email: string;

  /**
   * 8-72 characters with at least one letter and one number
   * @example "Passw0rd!"
   */
  @IsString()
  @Length(8, 72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'password must contain at least one letter and one number',
  })
  password: string;
}
