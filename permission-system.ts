/**
 * Role-Based Permission System for Multi-Tenant Architecture
 * Defines permissions for each role and provides permission checking utilities
 */

import type { UserRole, Permission, User } from '../types/multi-tenant';

// ============================================================================
// ROLE-BASED PERMISSION DEFINITIONS
// ============================================================================

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Users Management
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'write' },
    { resource: 'users', action: 'delete' },
    { resource: 'users', action: 'admin' },

    // Company Settings
    { resource: 'company', action: 'read' },
    { resource: 'company', action: 'write' },
    { resource: 'company', action: 'admin' },

    // Invitations
    { resource: 'invitations', action: 'read' },
    { resource: 'invitations', action: 'write' },
    { resource: 'invitations', action: 'delete' },

    // Billing
    { resource: 'billing', action: 'read' },
    { resource: 'billing', action: 'write' },
    { resource: 'billing', action: 'admin' },

    // Audit Logs
    { resource: 'auditLogs', action: 'read' },

    // All Business Data
    { resource: 'invoices', action: 'read' },
    { resource: 'invoices', action: 'write' },
    { resource: 'invoices', action: 'delete' },

    { resource: 'clients', action: 'read' },
    { resource: 'clients', action: 'write' },
    { resource: 'clients', action: 'delete' },

    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'write' },
    { resource: 'reports', action: 'delete' },

    { resource: 'exports', action: 'read' },
    { resource: 'exports', action: 'write' },
    { resource: 'exports', action: 'delete' },

    // Production & Quality
    { resource: 'productionReports', action: 'read' },
    { resource: 'productionReports', action: 'write' },
    { resource: 'productionReports', action: 'delete' },

    { resource: 'qualityControl', action: 'read' },
    { resource: 'qualityControl', action: 'write' },
    { resource: 'qualityControl', action: 'delete' },

    { resource: 'packaging', action: 'read' },
    { resource: 'packaging', action: 'write' },

    { resource: 'reception', action: 'read' },
    { resource: 'reception', action: 'write' },
  ],

  manager: [
    // Users - read only
    { resource: 'users', action: 'read' },

    // Company Settings - read only
    { resource: 'company', action: 'read' },

    // Audit Logs - read only
    { resource: 'auditLogs', action: 'read' },

    // All Business Data
    { resource: 'invoices', action: 'read' },
    { resource: 'invoices', action: 'write' },
    { resource: 'invoices', action: 'delete' },

    { resource: 'clients', action: 'read' },
    { resource: 'clients', action: 'write' },

    { resource: 'reports', action: 'read' },
    { resource: 'reports', action: 'write' },

    { resource: 'exports', action: 'read' },
    { resource: 'exports', action: 'write' },

    // Production & Quality
    { resource: 'productionReports', action: 'read' },
    { resource: 'productionReports', action: 'write' },

    { resource: 'qualityControl', action: 'read' },
    { resource: 'qualityControl', action: 'write' },

    { resource: 'packaging', action: 'read' },
    { resource: 'packaging', action: 'write' },

    { resource: 'reception', action: 'read' },
    { resource: 'reception', action: 'write' },
  ],

  employee: [
    // Users - read only
    { resource: 'users', action: 'read' },

    // Company Settings - read only
    { resource: 'company', action: 'read' },

    // Business Data - mostly read
    { resource: 'invoices', action: 'read' },
    { resource: 'clients', action: 'read' },

    { resource: 'reports', action: 'read' },
    { resource: 'exports', action: 'read' },

    // Production & Quality - read and create
    { resource: 'productionReports', action: 'read' },
    { resource: 'productionReports', action: 'write' },

    { resource: 'qualityControl', action: 'read' },
    { resource: 'qualityControl', action: 'write' },

    { resource: 'packaging', action: 'read' },
    { resource: 'packaging', action: 'write' },

    { resource: 'reception', action: 'read' },
    { resource: 'reception', action: 'write' },
  ],
};

// ============================================================================
// PERMISSION CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if user has permission for specific action on resource
 */
export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: 'read' | 'write' | 'delete' | 'admin'
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions.some(
    perm => perm.resource === resource && perm.action === action
  );
}

/**
 * Check if user can read resource
 */
export function canRead(userRole: UserRole, resource: string): boolean {
  return hasPermission(userRole, resource, 'read');
}

/**
 * Check if user can write to resource
 */
export function canWrite(userRole: UserRole, resource: string): boolean {
  return hasPermission(userRole, resource, 'write');
}

/**
 * Check if user can delete resource
 */
export function canDelete(userRole: UserRole, resource: string): boolean {
  return hasPermission(userRole, resource, 'delete');
}

/**
 * Check if user can perform admin actions
 */
export function canAdmin(userRole: UserRole, resource: string): boolean {
  return hasPermission(userRole, resource, 'admin');
}

/**
 * Get all resources user can read
 */
export function getReadableResources(userRole: UserRole): string[] {
  const permissions = ROLE_PERMISSIONS[userRole];
  return [...new Set(
    permissions
      .filter(perm => perm.action === 'read')
      .map(perm => perm.resource)
  )];
}

/**
 * Get all resources user can write to
 */
export function getWritableResources(userRole: UserRole): string[] {
  const permissions = ROLE_PERMISSIONS[userRole];
  return [...new Set(
    permissions
      .filter(perm => perm.action === 'write')
      .map(perm => perm.resource)
  )];
}

// ============================================================================
// DOCUMENT-LEVEL PERMISSION CHECKS
// ============================================================================

/**
 * Check if user can delete a document they created
 */
export function canDeleteOwnDocument(
  user: User,
  documents: { createdBy: string }
): boolean {
  // Managers and admins can delete any document
  if (user.role === 'admin' || user.role === 'manager') {
    return true;
  }

  // Employees can only delete their own
  return documents.createdBy === user.id;
}

/**
 * Check if user can modify a document
 */
export function canModifyDocument(
  user: User,
  document: { createdBy: string },
  action: 'read' | 'write' | 'delete'
): boolean {
  const resource = 'documents'; // Generic resource type

  // Check role-based permission first
  if (!hasPermission(user.role, resource, action)) {
    return false;
  }

  // For employees, additional restriction on write/delete
  if (user.role === 'employee' && (action === 'write' || action === 'delete')) {
    return document.createdBy === user.id;
  }

  return true;
}

// ============================================================================
// BUDGET/QUOTA CHECKS
// ============================================================================

/**
 * Check if user's company is within user limit
 */
export function canAddMoreUsers(
  currentUserCount: number,
  maxUsers: number | undefined,
  subscriptionPlan: string
): boolean {
  // Free plan: max 3 users
  if (subscriptionPlan === 'free') {
    return currentUserCount < 3;
  }

  // Pro plan: max 10 users
  if (subscriptionPlan === 'pro') {
    return currentUserCount < 10;
  }

  // Enterprise plan: custom limit
  if (subscriptionPlan === 'enterprise' && maxUsers) {
    return currentUserCount < maxUsers;
  }

  return true;
}

/**
 * Check if user's company can create exports
 */
export function canCreateExport(subscriptionPlan: string): boolean {
  // Only pro and enterprise can create exports
  return ['pro', 'enterprise'].includes(subscriptionPlan);
}

/**
 * Check if user's company can use advanced reports
 */
export function canUseAdvancedReports(subscriptionPlan: string): boolean {
  // Only pro and enterprise
  return ['pro', 'enterprise'].includes(subscriptionPlan);
}

/**
 * Check if user's company can use API access
 */
export function canUseApi(subscriptionPlan: string): boolean {
  // Only enterprise
  return subscriptionPlan === 'enterprise';
}

/**
 * Get feature availability by plan
 */
export function getFeatureAvailability(subscriptionPlan: string) {
  return {
    exports: ['pro', 'enterprise'].includes(subscriptionPlan),
    advancedReports: ['pro', 'enterprise'].includes(subscriptionPlan),
    apiAccess: subscriptionPlan === 'enterprise',
    customBranding: subscriptionPlan === 'enterprise',
    dedicatedSupport: subscriptionPlan === 'enterprise',
    twoFactorAuth: ['pro', 'enterprise'].includes(subscriptionPlan),
    sso: subscriptionPlan === 'enterprise',
    maxUsers: {
      free: 3,
      pro: 10,
      enterprise: Infinity,
    }[subscriptionPlan] || 1,
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export interface PermissionCheckLog {
  userId: string;
  userRole: UserRole;
  resource: string;
  action: string;
  granted: boolean;
  timestamp: Date;
  context?: Record<string, unknown>;
}

/**
 * Log permission check (for audit trail)
 */
export function logPermissionCheck(
  userId: string,
  userRole: UserRole,
  resource: string,
  action: string,
  granted: boolean,
  context?: Record<string, unknown>
): PermissionCheckLog {
  return {
    userId,
    userRole,
    resource,
    action,
    granted,
    timestamp: new Date(),
    context,
  };
}

// ============================================================================
// PERMISSION ERROR MESSAGES
// ============================================================================

export function getPermissionErrorMessage(
  resource: string,
  action: string,
  userRole: UserRole
): string {
  const actionText =
    action === 'read'
      ? 'view'
      : action === 'write'
      ? 'edit'
      : action === 'delete'
      ? 'delete'
      : 'manage';

  return `Your role (${userRole}) does not have permission to ${actionText} ${resource}. Please contact your administrator.`;
}
