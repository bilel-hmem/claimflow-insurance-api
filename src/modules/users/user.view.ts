import { Role } from '../../common/enums/role.enum';
import { User } from './user.entity';

export interface UserView {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface UserSummary {
  id: number;
  fullName: string;
  email: string;
}

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function toUserSummary(user?: User | null): UserSummary | null {
  return user ? { id: user.id, fullName: user.fullName, email: user.email } : null;
}
