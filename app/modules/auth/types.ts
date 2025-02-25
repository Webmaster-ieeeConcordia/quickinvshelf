import type { AuthSession } from "server/session";
import type { Organization } from "@prisma/client";

// Guest session type with nullable tokens
export interface GuestSession {
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresIn: number;
  expiresAt: number;
  email: string;
}

// Extended organization type with required fields
export interface ExtendedOrganization extends Organization {
  ssoDetails: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    domain: string;
    baseUserGroupId: string | null;
    selfServiceGroupId: string | null;
    adminGroupId: string | null;
  } | null;
  owner: {
    id: string;
    email: string;
  };
}

// Custom context type that allows either AuthSession or GuestSession
export interface CustomContext {
  getSession: () => AuthSession | GuestSession;
  setSession: (session: AuthSession | GuestSession) => void;
  isAuthenticated: boolean;
}
