// Shape returned by GET /admin/users. Mirrors the backend enums verbatim, so any change
// there has to be reflected here.
export type AccountLevel = 'FREE' | 'STARTER' | 'STANDARD' | 'PREMIUM' | 'UNLIMITED';

export type Role = 'USER' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export type AdminUser = {
  id: number;
  email: string;
  displayName: string | null;
  accountLevel: AccountLevel;
  role: Role;
  status: UserStatus;
  createdAt: string | null;
  lastSeenAt: string | null;
  tokensUsedToday: number;
};
