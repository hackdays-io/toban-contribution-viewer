import { TeamRole } from '../context/AuthContext';

/**
 * Checks if a user has the required role(s) for an operation
 * @param userRole The user's current role
 * @param requiredRoles An array of roles that are allowed to perform the operation
 * @returns True if the user has one of the required roles
 */
export function hasRequiredRole(
  userRole: TeamRole | undefined, 
  requiredRoles: TeamRole[]
): boolean {
  if (!userRole) return false;
  
  return requiredRoles.includes(userRole);
}

/**
 * Checks if a user can perform admin actions
 * @param userRole The user's current role
 * @returns True if the user has admin privileges
 */
export function canPerformAdminActions(userRole: TeamRole | undefined): boolean {
  return hasRequiredRole(userRole, ['owner', 'admin']);
}

/**
 * Checks if a user can view team resources
 * @param userRole The user's current role
 * @returns True if the user has view permissions
 */
export function canViewTeamResources(userRole: TeamRole | undefined): boolean {
  return hasRequiredRole(userRole, ['owner', 'admin', 'member', 'viewer']);
}

/**
 * Checks if a user can edit team resources
 * @param userRole The user's current role
 * @returns True if the user has edit permissions
 */
export function canEditTeamResources(userRole: TeamRole | undefined): boolean {
  return hasRequiredRole(userRole, ['owner', 'admin', 'member']);
}

/**
 * Returns the display name for a team role
 * @param role The team role
 * @returns A formatted display name for the role
 */
export function getRoleDisplayName(role: TeamRole | undefined): string {
  if (!role) return 'No Role';
  
  // Capitalize the first letter
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Returns a color scheme for a team role badge
 * @param role The team role
 * @returns A color scheme string for Chakra UI components
 */
export function getRoleBadgeColorScheme(role: TeamRole | undefined): string {
  switch (role) {
    case 'owner': return 'purple';
    case 'admin': return 'blue';
    case 'member': return 'green';
    case 'viewer': return 'teal';
    default: return 'gray';
  }
}
