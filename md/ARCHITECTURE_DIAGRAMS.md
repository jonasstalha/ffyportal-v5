# Multi-Tenant Architecture - Visual Diagrams

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                              │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │    Login     │  │  React App   │  │   Company Context        │  │
│  │   Page       │─→│  (Dashboard) │←─│   {companyId, user}      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│         │                 │                      │                   │
│         └─────────────────┼──────────────────────┘                   │
│                           │                                           │
│              ┌────────────▼────────────┐                             │
│              │                         │                             │
│              │  All Queries:           │                             │
│              │  - Include companyId    │                             │
│              │  - Get from context     │                             │
│              │  - Filter by companyId  │                             │
│              │                         │                             │
│              └────────────┬────────────┘                             │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                    HTTP/WebSocket
                            │
                ┌───────────▼──────────┐
                │   Firebase SDK       │
                │   (auth + firestore) │
                └───────────┬──────────┘
                            │
┌───────────────────────────┼──────────────────────────────────────────┐
│                   FIREBASE CLOUD INFRASTRUCTURE                      │
│                                                                       │
│  ┌──────────────┐         ┌────────────────────────────────────┐    │
│  │ Firebase     │         │    Firestore Database              │    │
│  │ Auth         │         │                                    │    │
│  │              │         │  ┌─────────────────────────────┐   │    │
│  │ • UID        │         │  │ companies collection        │   │    │
│  │ • Email      │         │  └─────────────────────────────┘   │    │
│  │ • Password   │         │                                    │    │
│  │ • Disabled   │         │  ┌─────────────────────────────┐   │    │
│  └──────┬───────┘         │  │ users collection            │   │    │
│         │                 │  │ - companyId (CRITICAL)      │   │    │
│    ┌────▼────┐            │  │ - role                      │   │    │
│    │          │            │  │ - status                    │   │    │
│    │ Custom   │            │  └─────────────────────────────┘   │    │
│    │ Claims   │            │                                    │    │
│    │          │            │  ┌─────────────────────────────┐   │    │
│    │ {        │            │  │ invoices collection         │   │    │
│    │  companyId           │  │ - companyId (CRITICAL)      │   │    │
│    │  role    │            │  │ - amount                    │   │    │
│    │  email   │            │  │ - clientId                  │   │    │
│    │ }        │            │  └─────────────────────────────┘   │    │
│    └────┬────┘            │                                    │    │
│         │                 │  ┌─────────────────────────────┐   │    │
│    ┌────▼─────────┐       │  │ clients collection          │   │    │
│    │   Token      │       │  │ - companyId (CRITICAL)      │   │    │
│    │  (includes   │       │  │ - name, email               │   │    │
│    │   claims)    │       │  └─────────────────────────────┘   │    │
│    └──────────────┘       │                                    │    │
│                           │  ┌─────────────────────────────┐   │    │
│                           │  │ reports collection          │   │    │
│                           │  │ - companyId (CRITICAL)      │   │    │
│                           │  │ - title, metrics            │   │    │
│                           │  └─────────────────────────────┘   │    │
│                           │                                    │    │
│                           └────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │          Cloud Functions (Custom Claims, Invites)            │   │
│  │                                                              │   │
│  │  • setCustomUserClaims(uid, {companyId, role, email})      │   │
│  │  • sendCompanyInvitation(companyId, email, role)           │   │
│  │  • removeUserFromCompany(companyId, userId)                │   │
│  │  • updateCompanySubscription(companyId, plan)              │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Security Rules                            │   │
│  │                                                              │   │
│  │  match /invoices/{docId} {                                 │   │
│  │    allow read: if resource.data.companyId ==               │   │
│  │                   request.auth.token.companyId;            │   │
│  │    allow write: if request.resource.data.companyId ==      │   │
│  │                    request.auth.token.companyId            │   │
│  │                    && hasPermission(request.auth.token);   │   │
│  │  }                                                           │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### User Sign-Up (New Company)

```
┌──────────────────────────────────────────────────────────────┐
│                   Sign Up Process                            │
└──────────────────────────────────────────────────────────────┘

    User Signs Up
          │
          ▼
    ┌────────────────────────┐
    │  Client: signUpNewCompany(
    │   - email
    │   - password
    │   - displayName
    │   - companyName
    │  )
    └────────────────────────┘
          │
          ▼
    Cloud Function / Frontend Auth
          │
          ├─► 1. Create Firebase Auth User
          │        • UID generated
          │        • Password hashed
          │
          ├─► 2. Create Company Document
          │        • ID: random UUID
          │        • name: from input
          │        • ownerId: new UID
          │        • subscriptionPlan: 'free'
          │        • status: 'active'
          │
          ├─► 3. Create User Document
          │        • ID: same as UID
          │        • email: from input
          │        • displayName: from input
          │        • companyId: ⭐ LINK TO COMPANY
          │        • role: 'admin'
          │        • status: 'active'
          │
          └─► 4. Set Custom Claims
               • Call setCustomUserClaims()
               • claims = {
                   companyId,
                   role: 'admin',
                   email
                 }
          
          ▼
    ┌────────────────────────┐
    │  Token Refreshed       │
    │  • Now includes custom │
    │    claims in JWT       │
    │  • Frontend can read   │
    │    companyId from claims
    └────────────────────────┘
          │
          ▼
    ┌────────────────────────┐
    │  User Logged In        │
    │  Redirect to Dashboard │
    └────────────────────────┘
```

### User Login

```
┌──────────────────────────────────────────────────────────────┐
│                   Login Process                              │
└──────────────────────────────────────────────────────────────┘

    User Enters Email/Password
          │
          ▼
    ┌────────────────────────┐
    │  Client: loginUser(    │
    │   email,               │
    │   password             │
    │  )
    └────────────────────────┘
          │
          ▼
    Firebase Auth Verification
          │
          ├─► Valid? YES → Continue
          │              NO  → Show Error → STOP
          │
          ▼
    ┌────────────────────────┐
    │  Auth Token Created    │
    │  (with custom claims)  │
    │                        │
    │  {                     │
    │   aud: "...",          │
    │   ...                  │
    │   companyId: "abc123",◄─── CRITICAL
    │   role: "admin",       │
    │   email: "user@..."    │
    │  }
    └────────────────────────┘
          │
          ▼
    ┌────────────────────────────────────────┐
    │  Frontend: Fetch User Document         │
    │  db.collection('users').doc(uid).get() │
    │                                        │
    │  Returns:                              │
    │  {                                     │
    │   email: "user@...",                   │
    │   displayName: "John",                 │
    │   companyId: "abc123",                 │
    │   role: "admin",                       │
    │   ...                                  │
    │  }
    └────────────────────────────────────────┘
          │
          ▼
    ┌────────────────────────────────────────┐
    │  CompanyContext Initialized            │
    │  setCurrentUser({...})                 │
    │  setCurrentCompanyId("abc123")         │
    └────────────────────────────────────────┘
          │
          ▼
    ┌────────────────────────┐
    │  App Ready             │
    │  User can query data   │
    │  with company context  │
    └────────────────────────┘
```

### Query Flow

```
┌──────────────────────────────────────────────────────────────┐
│              Firestore Query Flow                            │
└──────────────────────────────────────────────────────────────┘

    Component Renders
          │
          ▼
    ┌──────────────────────────────────┐
    │  const companyId = useCompanyId()│
    │                                  │
    │  const invoices = await db       │
    │    .collection('invoices')       │
    │    .where('companyId', '==',◄────┼─ REQUIRED FILTER
    │           companyId)             │
    │    .get()
    └──────────────────────────────────┘
          │
          ▼
    Firebase SDK
          │
          ├─► 1. Get auth token from localStorage
          │
          ├─► 2. Extract custom claims
          │      claims.companyId = "abc123"
          │
          └─► 3. Send to Firestore:
               • Collection: invoices
               • Filter: companyId == "abc123"
               • Include auth token
          
          ▼
    Security Rules Engine
          │
          ├─► Check: request.auth != null?
          │   YES ✓ Continue
          │   NO  ✗ DENY
          │
          ├─► Check: resource.data.companyId == 
          │           request.auth.token.companyId?
          │   YES ✓ Continue
          │   NO  ✗ DENY
          │
          └─► Check: User has permission for 'read'?
               YES ✓ Return documents
               NO  ✗ DENY
          
          ▼
    ┌──────────────────────────────────┐
    │  Only Matching Documents         │
    │                                  │
    │  [                               │
    │   {                              │
    │    id: "inv1",                   │
    │    companyId: "abc123",          │
    │    amount: 1000,                 │
    │    ...                           │
    │   },                             │
    │   {                              │
    │    id: "inv2",                   │
    │    companyId: "abc123",          │
    │    amount: 2000,                 │
    │    ...                           │
    │   }                              │
    │  ]                               │
    │                                  │
    │  ⚠️ If companyId was "xyz789"   │
    │  their invoices would NOT appear │
    └──────────────────────────────────┘
          │
          ▼
    Frontend: Update State
    Display in UI
```

---

## Tenant Isolation - The Key

```
┌──────────────────────────────────────────────────────────────┐
│         How Tenant Isolation Works                           │
└──────────────────────────────────────────────────────────────┘

SCENARIO: Two Companies, Same Database

┌─────────────────────────┐       ┌─────────────────────────┐
│   COMPANY A (abc123)    │       │   COMPANY B (xyz789)    │
│                         │       │                         │
│  User: alice@a.com      │       │  User: bob@b.com        │
│  Token Claims:          │       │  Token Claims:          │
│  {                      │       │  {                      │
│   companyId: "abc123"   │       │   companyId: "xyz789"   │
│   role: "admin"         │       │   role: "admin"         │
│  }                      │       │  }                      │
│                         │       │                         │
└────────────┬────────────┘       └────────────┬────────────┘
             │                                 │
             │ Queries invoices                │ Queries invoices
             │                                 │
             ▼                                 ▼
    ┌────────────────────┐        ┌────────────────────┐
    │ where('companyId',◄┤        │ where('companyId',◄┤
    │  '==', "abc123")   │        │  '==', "xyz789")   │
    └────────────┬───────┘        └────────────┬───────┘
                 │                             │
                 └──────────────┬──────────────┘
                                │
                        Security Rules
                                │
                    ┌───────────▼───────────┐
                    │  Validate token's     │
                    │  companyId matches    │
                    │  document's companyId │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
            ALICE's Results          BOB's Results
    ┌────────────────────────┐  ┌────────────────────────┐
    │ Invoice A1             │  │ Invoice B1             │
    │ companyId: "abc123" ✓  │  │ companyId: "xyz789" ✓  │
    │                        │  │                        │
    │ Invoice A2             │  │ Invoice B2             │
    │ companyId: "abc123" ✓  │  │ companyId: "xyz789" ✓  │
    └────────────────────────┘  └────────────────────────┘
    
    ❌ Impossible for Alice to see Bob's invoices
    ❌ Impossible for Bob to see Alice's invoices
    ✅ Even if a bug exists in query, rules prevent leakage
```

---

## Permission Hierarchy

```
┌──────────────────────────────────────────────────────────────┐
│            Role-Based Permission Pyramid                     │
└──────────────────────────────────────────────────────────────┘

                          ▲
                         ╱ ╲
                        ╱   ╲
                       ╱ ADMIN╲  Can do EVERYTHING
                      ╱ (100%) ╲
                     ╱───────────╲
                    ╱             ╲
                   ╱   MANAGER     ╲  Can create, edit, delete most
                  ╱   (75% perms)   ╲ features, manage data
                 ╱─────────────────────╲
                ╱                       ╲
               ╱     EMPLOYEE           ╲ Can create & view data,
              ╱      (40% perms)         ╲ limited editing
             ╱─────────────────────────────╲
            ╱                               ╱
           ╱─────────────────────────────────

ADMIN
├── ✅ Manage users (add/remove/change roles)
├── ✅ Company settings
├── ✅ Billing & subscription
├── ✅ Create/Read/Update/Delete all data
├── ✅ View audit logs
├── ✅ Send invitations
└── ✅ Everything else

MANAGER
├── ✅ Create/Read/Update/Delete invoices & reports
├── ✅ Manage clients
├── ✅ View users (read-only)
├── ✅ View company settings (read-only)
├── ✅ View audit logs (read-only)
├── ❌ Cannot manage users
└── ❌ Cannot adjust billing

EMPLOYEE
├── ✅ Create entries (reports, quality checks, etc.)
├── ✅ View company data
├── ✅ Read invoices & clients
├── ❌ Cannot delete documents
├── ❌ Cannot modify others' data
└── ❌ Cannot access settings/billing
```

---

## Data Migration Flow

```
┌──────────────────────────────────────────────────────────────┐
│           Migration: Single → Multi-Tenant                   │
└──────────────────────────────────────────────────────────────┘

BEFORE (Single-Tenant)
┌─────────────────┐
│  users          │
│  ├─ user1       │
│  └─ user2       │
│                 │
│  invoices       │
│  ├─ inv1        │
│  ├─ inv2        │
│  └─ inv3        │
│                 │
│  clients        │
│  ├─ client1     │
│  └─ client2     │
└─────────────────┘
(NO companyId)

    │
    │ Run migration-script.ts
    │
    ▼

AFTER (Multi-Tenant)
┌──────────────────────────┐
│  companies               │
│  ├─ default-company-id   │
│                          │
│  users                   │
│  ├─ user1                │
│  │  └─ companyId: "abc"  │◄─ ADDED
│  └─ user2                │
│     └─ companyId: "abc"  │◄─ ADDED
│                          │
│  invoices                │
│  ├─ inv1                 │
│  │  └─ companyId: "abc"  │◄─ ADDED
│  ├─ inv2                 │
│  │  └─ companyId: "abc"  │◄─ ADDED
│  └─ inv3                 │
│     └─ companyId: "abc"  │◄─ ADDED
│                          │
│  clients                 │
│  ├─ client1              │
│  │  └─ companyId: "abc"  │◄─ ADDED
│  └─ client2              │
│     └─ companyId: "abc"  │◄─ ADDED
└──────────────────────────┘

Steps:
1. Create companies/{default-id}
2. Add companyId to all users
3. Add companyId to all invoices
4. Add companyId to all clients
5. Add companyId to all reports
6. Update Firebase Auth custom claims
7. Verify no documents without companyId
```

---

## Security Model

```
┌──────────────────────────────────────────────────────────────┐
│      Multi-Layer Security Model                              │
└──────────────────────────────────────────────────────────────┘

LAYER 1: Authentication
┌─────────────────────────────────┐
│ Firebase Auth                   │
│ • Email/Password verification   │
│ • UID generation                │
│ • Token creation                │
└─────────────────────────────────┘

LAYER 2: Custom Claims
┌─────────────────────────────────┐
│ JWT Token Payload               │
│ {                               │
│   "companyId": "abc123",        │
│   "role": "admin",              │
│   "email": "user@example.com"   │
│ }                               │
└─────────────────────────────────┘

LAYER 3: Firestore Security Rules
┌─────────────────────────────────────────────────────┐
│ match /invoices/{docId} {                           │
│   allow read: if                                    │
│     request.auth != null &&                         │
│     resource.data.companyId ==                      │
│       request.auth.token.companyId;                │
│                                                     │
│   allow write: if                                   │
│     request.auth != null &&                         │
│     request.resource.data.companyId ==              │
│       request.auth.token.companyId &&               │
│     hasPermission(request.auth.token.role);        │
│ }                                                   │
└─────────────────────────────────────────────────────┘

LAYER 4: Application Logic
┌─────────────────────────────────┐
│ Frontend Context                │
│ • Verify companyId in context   │
│ • Check user role               │
│ • Enforce UI permissions        │
└─────────────────────────────────┘

RESULT:
✅ Even if one layer has a bug, others prevent
   data leakage or unauthorized access
✅ Defense in depth approach
✅ Tenant isolation guaranteed
```

---

## Subscription Plan Features

```
┌──────────────────────────────────────────────────────────────┐
│        Feature Availability by Plan                          │
└──────────────────────────────────────────────────────────────┘

                   FREE          PRO          ENTERPRISE
              ┌──────────┬──────────┬──────────┐
Users         │    3     │   10     │ Unlimited│
              ├──────────┼──────────┼──────────┤
Invoices      │   ✓      │    ✓     │    ✓     │
              ├──────────┼──────────┼──────────┤
Reports       │   ✓      │    ✓     │    ✓     │
              ├──────────┼──────────┼──────────┤
Exports       │   ❌     │    ✓     │    ✓     │
              ├──────────┼──────────┼──────────┤
Advanced      │          │          │          │
Reports       │   ❌     │    ✓     │    ✓     │
              ├──────────┼──────────┼──────────┤
API Access    │   ❌     │    ❌    │    ✓     │
              ├──────────┼──────────┼──────────┤
Custom Domain │   ❌     │    ❌    │    ✓     │
              ├──────────┼──────────┼──────────┤
2FA           │   ❌     │    ✓     │    ✓     │
              ├──────────┼──────────┼──────────┤
SSO           │   ❌     │    ❌    │    ✓     │
              ├──────────┼──────────┼──────────┤
Support       │  Limited │ Priority │Dedicated │
              └──────────┴──────────┴──────────┘

Implemented in Company document:
{
  subscriptionPlan: "pro",
  metadata: {
    maxUsers: 10,
    customDomain: false,
    apiAccess: false,
    ...
  }
}

Enforced in Cloud Functions:
- Check plan before allowing exports
- Check plan before enabling API keys
- Check user count before adding users
- Check plan for feature access
```

These diagrams provide a visual understanding of how the multi-tenant architecture works,
how data flows through the system, and how isolation is maintained across tenants.
