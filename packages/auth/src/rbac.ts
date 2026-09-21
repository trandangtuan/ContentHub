export type Role = "READER" | "CREATOR" | "MODERATOR" | "ADMIN";

const ROLE_RANK: Record<Role, number> = {
  READER: 0,
  CREATOR: 1,
  MODERATOR: 2,
  ADMIN: 3,
};

/** True if `role` has at least the privilege level of `required`. RBAC is always checked server-side (spec #82). */
export function hasRole(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

export function isOwnerOrRole(params: { userId: string; ownerId: string; role: Role; requiredRole: Role }): boolean {
  if (params.userId === params.ownerId) return true;
  return hasRole(params.role, params.requiredRole);
}
