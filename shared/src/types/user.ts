export interface UserRole {
  name: string;
  permissions: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  roles: string[];
  permissions: string[];
  forfait?: string;
  organizationId?: number;
  organizationName?: string;
  platformRole?: string;
  orgRole?: string;
}
