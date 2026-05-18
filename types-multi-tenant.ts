/**
 * Multi-Tenant Architecture Types
 * TypeScript interfaces and types for the SaaS platform
 */

// ============================================================================
// COMPANY TYPES
// ============================================================================

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';
export type CompanyStatus = 'active' | 'suspended' | 'cancelled';
export type UserRole = 'admin' | 'manager' | 'employee';
export type UserStatus = 'active' | 'inactive' | 'invited';

export interface Company {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt?: Date;
  ownerId: string; // Firebase UID of the company owner
  subscriptionPlan: SubscriptionPlan;
  status: CompanyStatus;
  metadata?: CompanyMetadata;
  billingEmail?: string;
  phone?: string;
}

export interface CompanyMetadata {
  logoUrl?: string;
  website?: string;
  maxUsers?: number;
  customDomain?: string;
  subdomain?: string;
  stripeCustomerId?: string;
  stripePriceId?: string;
  subscriptionPeriodEnd?: Date;
  features?: CompanyFeatures;
}

export interface CompanyFeatures {
  advancedReports: boolean;
  apiAccess: boolean;
  customBranding: boolean;
  dedicatedSupport: boolean;
  twoFactorAuth: boolean;
  sso: boolean;
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  id: string; // Firebase UID
  email: string;
  displayName: string;
  photoURL?: string;
  companyId: string; // ⭐ CRITICAL: Links user to company
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  deletedAt?: Date; // For soft delete
  permissions?: string[]; // Additional granular permissions
  metadata?: UserMetadata;
}

export interface UserMetadata {
  department?: string;
  title?: string;
  phone?: string;
  avatar?: string;
  timezone?: string;
  language?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  darkMode: boolean;
  pageSize: number;
}

// ============================================================================
// FIREBASE CUSTOM CLAIMS
// ============================================================================

export interface CustomUserClaims {
  companyId: string;
  role: UserRole;
  email: string;
}

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
  companyName?: string; // For new company registration
  inviteCode?: string; // For joining existing company
}

export interface InvitationLink {
  id: string;
  companyId: string;
  invitedEmail: string;
  invitedBy: string; // UID of person sending invite
  role: UserRole;
  status: 'pending' | 'accepted' | 'expired';
  inviteCode: string;
  createdAt: Date;
  expiresAt: Date;
}

// ============================================================================
// BUSINESS DATA TYPES
// ============================================================================

export interface Invoice {
  id: string;
  companyId: string; // ⭐ REQUIRED for multi-tenant
  invoiceNumber: string;
  clientId: string;
  amount: number;
  currency: string;
  items: InvoiceItem[];
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  dueDate?: Date;
  issuedDate: Date;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string; // UID
  modifiedBy?: string; // UID
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Client {
  id: string;
  companyId: string; // ⭐ REQUIRED
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
  status: 'active' | 'inactive';
}

export interface ProductionReport {
  id: string;
  companyId: string; // ⭐ REQUIRED
  title: string;
  description?: string;
  reportDate: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: ProductionMetrics;
  attachments?: Attachment[];
  status: 'draft' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
  reviewedBy?: string;
}

export interface ProductionMetrics {
  totalProduced: number;
  totalDisposed: number;
  defectRate: number;
  efficiency: number;
  [key: string]: number;
}

export interface Export {
  id: string;
  companyId: string; // ⭐ REQUIRED
  description: string;
  format: 'csv' | 'excel' | 'pdf' | 'json';
  filterCriteria: Record<string, unknown>;
  downloadUrl?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  createdBy: string;
  expiresAt?: Date;
}

export interface PackagingTrace {
  id: string;
  companyId: string; // ⭐ REQUIRED
  lotNumber: string;
  batchId?: string;
  status: 'brouillon' | 'en_cours' | 'termine';
  emballageData: PackagingData;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
  archived: boolean;
  archivedAt?: Date;
}

export interface PackagingData {
  type: string;
  weight: number;
  quantity: number;
  variety: string;
  [key: string]: unknown;
}

export interface ReceptionEntry {
  id: string;
  companyId: string; // ⭐ REQUIRED
  lotNumber: string;
  receptionDateTime: Date;
  farm: string;
  variety: string;
  quantity: number;
  unit: string;
  category: 'conventionnel' | 'biologique';
  qualityScore?: number;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
}

export interface BatchUpload {
  id: string;
  companyId: string; // ⭐ REQUIRED
  fileName: string;
  fileSize: number;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errors?: UploadError[];
  createdAt: Date;
  completedAt?: Date;
  createdBy: string;
}

export interface UploadError {
  rowNumber: number;
  field: string;
  value: string;
  error: string;
}

export interface Attachment {
  id: string;
  storageUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  action: string;
  collection: string;
  documentId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  result: 'success' | 'failed';
  errorMessage?: string;
  createdAt: Date;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface CompanyContextType {
  currentCompanyId: string | null;
  currentCompany: Company | null;
  currentUser: User | null;
  isLoading: boolean;
  error: Error | null;
  setCurrentCompanyId: (companyId: string) => void;
  refreshCompany: () => Promise<void>;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (data: SignUpData) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  error: Error | null;
}

// ============================================================================
// PERMISSION TYPES
// ============================================================================

export interface Permission {
  resource: string; // e.g., 'invoices', 'users', 'reports'
  action: 'read' | 'write' | 'delete' | 'admin';
  scopes?: string[];
}

export type RolePermissions = {
  [key in UserRole]: Permission[];
};

// ============================================================================
// STRIPE INTEGRATION TYPES (Future)
// ============================================================================

export interface StripeCustomerMetadata {
  companyId: string;
  subscriptionPlan: SubscriptionPlan;
  status: 'active' | 'past_due' | 'unpaid' | 'canceled';
}

export interface SubscriptionEvent {
  type: 'created' | 'updated' | 'deleted' | 'expired';
  companyId: string;
  subscriptionId: string;
  planId: string;
  timestamp: Date;
}
