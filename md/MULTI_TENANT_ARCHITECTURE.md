# Multi-Tenant SaaS Architecture Migration Guide

## Overview
This guide provides a complete roadmap for converting your Firebase app from single-tenant to multi-tenant SaaS architecture.

---

## 1. DATABASE STRUCTURE

### New Collections

#### `companies`
```
companies/
├── {companyId}
│   ├── name: string
│   ├── createdAt: timestamp
│   ├── ownerId: string (uid of the company owner/admin)
│   ├── subscriptionPlan: string ("free", "pro", "enterprise")
│   ├── status: string ("active", "suspended", "cancelled")
│   ├── metadata: {
│   │   └── logoUrl?: string
│   │   └── website?: string
│   │   └── maxUsers?: number
│   │   └── customDomain?: string
│   └── }
│   └── billingEmail?: string
│   └── phone?: string
```

#### `users`
```
users/
├── {userId}
│   ├── email: string
│   ├── displayName: string
│   ├── photoURL?: string
│   ├── companyId: string (⭐ REQUIRED - foreign key to companies)
│   ├── role: enum ("admin", "manager", "employee")
│   ├── status: string ("active", "inactive", "invited")
│   ├── createdAt: timestamp
│   ├── updatedAt: timestamp
│   ├── lastLogin?: timestamp
│   ├── deletedAt?: timestamp (soft delete)
│   └── permissions?: string[] (optional - role-based)
```

#### Business Data Collections (Updated)
All existing collections must include `companyId`:

**invoices**
```
companies/{companyId}/invoices/
├── {invoiceId}
│   ├── companyId: string (⭐ REQUIRED)
│   ├── invoiceNumber: string
│   ├── clientId: string
│   ├── amount: number
│   ├── items: array
│   ├── createdAt: timestamp
│   ├── updatedAt: timestamp
│   ├── createdBy: string (userId)
│   └── ...
```

**clients**
```
companies/{companyId}/clients/
├── {clientId}
│   ├── companyId: string (⭐ REQUIRED)
│   ├── name: string
│   ├── email: string
│   ├── phone: string
│   ├── createdAt: timestamp
│   └── ...
```

**Other Collections**
- `companies/{companyId}/exports/`
- `companies/{companyId}/reports/`
- `companies/{companyId}/productionReports/`
- `companies/{companyId}/packaging_traces/`
- `companies/{companyId}/receptionEntries/`
- Any other business data

---

## 2. FIRESTORE SECURITY RULES

See: **firestore-rules-multi-tenant.txt** for complete security rules

### Key Principles
1. **Tenant Isolation**: All writes check `companyId` matches user's company
2. **Role-Based Access**: Admin/Manager/Employee have different permissions
3. **No Cross-Tenant Access**: Impossible to read/write another company's data
4. **Custom Claims**: Validate `companyId` from auth token

---

## 3. FIREBASE AUTH CUSTOM CLAIMS

Every authenticated user gets custom claims:

```json
{
  "companyId": "company-uuid-123",
  "role": "admin",
  "email": "user@example.com"
}
```

**Setting Claims** (from admin backend):
```typescript
await admin.auth().setCustomUserClaims(uid, {
  companyId: newCompanyId,
  role: "admin",
  email: user.email
});
```

**Reading Claims** (from frontend):
```typescript
const token = await user.getIdTokenResult();
const { companyId, role } = token.claims;
```

---

## 4. USER FLOWS

### A. Sign-Up (New Company)
1. User creates account via Firebase Auth
2. Backend creates new Company document
3. Backend assigns user as owner/admin
4. Backend sets custom claims with companyId
5. Frontend stores companyId in local context/state
6. User redirected to onboarding

### B. Sign-Up (Join Existing Company via Invitation)
1. User receives invite link: `https://app.com/join?inviteCode=abc123`
2. User creates account (or logs in if exists)
3. Backend validates invite code (check from invitations subcollection)
4. Backend assigns user to company
5. Backend sets custom claims
6. User can access company data

### C. Login
1. User logs in with email/password
2. Frontend fetches user document + custom claims
3. Frontend retrieves companyId from custom claims
4. Frontend initializes app with companyContext
5. All subsequent queries scoped to companyId

---

## 5. QUERY PATTERNS

### Rule: Every Query Must Include companyId Filter

**❌ WRONG:**
```typescript
const snapshot = await db.collection('invoices').get();
```

**✅ CORRECT:**
```typescript
const ({ companyId } = useContext(CompanyContext);
const snapshot = await db.collection(`companies/${companyId}/invoices`).get();
```

OR (if using root-level collections):
```typescript
const snapshot = await db
  .collection('invoices')
  .where('companyId', '==', companyId)  // Required filter
  .get();
```

### Common Query Examples

**Get all clients for current company:**
```typescript
const clientsRef = db.collection(`companies/${companyId}/clients`);
const snapshot = await clientsRef.orderBy('createdAt', 'desc').get();
```

**Get invoices by date range:**
```typescript
const invoicesRef = db.collection(`companies/${companyId}/invoices`);
const snapshot = await invoicesRef
  .where('createdAt', '>=', startDate)
  .where('createdAt', '<=', endDate)
  .orderBy('createdAt', 'desc')
  .get();
```

**Get users in company (admin only):**
```typescript
const usersRef = db.collection('users');
const snapshot = await usersRef
  .where('companyId', '==', companyId)
  .where('status', '==', 'active')
  .get();
```

---

## 6. FOLDER STRUCTURE (RECOMMENDED)

```
fruitsforyou/src/
├── lib/
│   ├── firebase/
│   │   ├── index.ts
│   │   ├── auth.ts (authentication functions)
│   │   └── firestore.ts (Firestore initialization)
│   ├── multi-tenant/
│   │   ├── context.ts (CompanyContext)
│   │   ├── hooks.ts (useCompany, useCompanyId, etc.)
│   │   ├── types.ts (Company, User types)
│   │   └── guards.ts (permission checks)
│   ├── queries/
│   │   ├── companies.ts
│   │   ├── users.ts
│   │   ├── clients.ts
│   │   ├── invoices.ts
│   │   ├── exports.ts
│   │   ├── reports.ts
│   │   └── index.ts (barrel export)
│   └── mutations/
│       ├── companies.ts
│       ├── users.ts
│       ├── clients.ts
│       ├── invoices.ts
│       └── index.ts
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignUpForm.tsx
│   │   │   └── InvitationAccept.tsx
│   │   ├── pages/
│   │   │   └── AuthPage.tsx
│   │   └── hooks/
│   │       └── useAuth.ts
│   ├── company/
│   │   ├── components/
│   │   │   └── CompanySelector.tsx
│   │   ├── pages/
│   │   │   ├── CompanyOnboarding.tsx
│   │   │   └── CompanySettings.tsx
│   │   └── hooks/
│   │       └── useCompanySettings.ts
│   ├── invoices/
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   ├── clients/
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   ├── reports/
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   └── admin/
│       ├── components/
│       │   ├── UserManagement.tsx
│       │   ├── SubscriptionManager.tsx
│       │   └── CompanyInvitations.tsx
│       └── pages/
│           └── AdminPanel.tsx
├── context/
│   ├── CompanyContext.tsx
│   ├── AuthContext.tsx
│   └── PermissionContext.tsx
├── types/
│   ├── company.ts
│   ├── user.ts
│   ├── invoice.ts
│   ├── client.ts
│   └── index.ts
├── pages/
│   ├── Dashboard.tsx
│   ├── NotFound.tsx
│   └── Unauthorized.tsx
├── middleware/
│   ├── withCompanyScope.tsx (HOC)
│   └── requirePermission.tsx (HOC)
└── App.tsx
```

---

## 7. MIGRATION CHECKLIST

- [ ] Add `companyId` field to all existing collections
- [ ] Create companies collection
- [ ] Update users collection with companyId, role
- [ ] Create multi-tenant context and hooks
- [ ] Create/update Firestore security rules
- [ ] Create company onboarding flow
- [ ] Create invitation system
- [ ] Update all queries to filter by companyId
- [ ] Update registration/sign-up flow
- [ ] Create admin panel for company management
- [ ] Set up custom claims middleware
- [ ] Add role-based permission system
- [ ] Create company settings page
- [ ] Create user invitation component
- [ ] Write migration script for existing data
- [ ] Test tenant isolation
- [ ] Deploy security rules
- [ ] Document API endpoints (if using backend)

---

## 8. NEXT STEPS

1. Start with **types/** - define Company, User, and other types
2. Create **context/** - CompanyContext for app-wide company access
3. Update **firestore.rules** - implement tenant isolation
4. Create **lib/queries/** - all Firestore queries with companyId
5. Update authentication - set custom claims on user creation
6. Update registration flow - create company on sign-up
7. Wrap app with CompanyProvider
8. Test thoroughly before production

---

## 9. STRIPE INTEGRATION NOTES (Future)

```typescript
// Company document extension
{
  subscriptionPlan: "pro",
  stripeCustomerId: "cus_xyz123",
  stripePriceId: "price_xyz123",
  subscriptionStatus: "active",
  subscriptionPeriodEnd: timestamp,
  maxUsers: 50,
  features: {
    advancedReports: true,
    apiAccess: false,
    customBranding: true
  }
}
```

---

## 10. SUBDOMAIN SUPPORT (Future)

```typescript
// Company metadata
{
  customDomain: "acmecorp.fruitsforyou.com",
  // OR
  subdomain: "acmecorp"
  // Requires routing based on host in main app.tsx
}
```

---

## FILES PROVIDED

1. **firestore-rules-multi-tenant.txt** - Complete security rules
2. **types-multi-tenant.ts** - TypeScript interfaces
3. **company-context.tsx** - React context
4. **company-hooks.ts** - Custom hooks
5. **auth-service.ts** - Authentication functions
6. **query-examples.ts** - Firestore query patterns
7. **registration-flow.ts** - Sign-up logic
8. **permission-system.ts** - Role-based access control

All files are production-ready and fully documented.
