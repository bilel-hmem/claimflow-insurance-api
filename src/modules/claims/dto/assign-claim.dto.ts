import { IsInt, Min } from 'class-validator';

export class AssignClaimDto {
  /** Id of a user with the ADJUSTER role @example 2 */
  @IsInt()
  @Min(1)
  adjusterId: number;
}
