# Multi-Tenant SaaS Implementation Guide

## Complete Step-by-Step Instructions

This guide walks through implementing multi-tenant architecture in your Firebase app.

---

## PHASE 1: PREPARATION (Week 1)

### Step 1.1: Backup Current Data

```bash
# Export current Firestore data
firebase firestore:export ./backup/firestore-backup-$(date +%Y%m%d)
```

### Step 1.2: Review Provided Files

You have been provided:
- ✅ `MULTI_TENANT_ARCHITECTURE.md` - Overview
- ✅ `firestore-rules-multi-tenant.txt` - Security rules
- ✅ `types-multi-tenant.ts` - TypeScript interfaces
- ✅ `company-context.tsx` - React context
- ✅ `auth-service.ts` - Authentication functions
- ✅ `query-examples.ts` - Firestore query patterns
- ✅ `permission-system.ts` - Role-based access control
- ✅ `migration-script.ts` - Data migration script
- ✅ `cloud-functions-multi-tenant.ts` - Backend functions
- ✅ `example-components.tsx` - React components

### Step 1.3: Create Project Folder Structure

```bash
# In your fruitsforyou/src folder, create:
mkdir -p lib/firebase
mkdir -p lib/multi-tenant
mkdir -p lib/queries
mkdir -p lib/mutations
mkdir -p context
mkdir -p types
mkdir -p middleware
mkdir -p features/auth/components
mkdir -p features/auth/pages
mkdir -p features/auth/hooks
mkdir -p features/company/components
mkdir -p features/company/pages
mkdir -p features/admin/components
```

---

## PHASE 2: TYPE DEFINITIONS (Week 1)

### Step 2.1: Create TypeScript Types

1. Copy the content from `types-multi-tenant.ts`
2. Create `src/types/multi-tenant.ts` in your project
3. Import these types throughout your app:

```typescript
// src/types/index.ts
export * from './multi-tenant';
```

### Step 2.2: Update Existing Types

Extend your existing types to inherit from multi-tenant types:

```typescript
// src/types/invoice.ts
import { Invoice as BaseInvoice } from './multi-tenant';

export interface InvoiceExtended extends BaseInvoice {
  customField?: string;
}
```

---

## PHASE 3: FIREBASE SETUP (Week 1-2)

### Step 3.1: Initialize Firebase

Create `src/lib/firebase/index.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');
```

### Step 3.2: Deploy Cloud Functions

1. Copy `cloud-functions-multi-tenant.ts` to `functions/src/index.ts`
2. Update imports:

```bash
cd functions
npm install
firebase deploy --only functions
```

### Step 3.3: Update Security Rules

1. Replace existing `firestore.rules` with `firestore-rules-multi-tenant.txt`
2. Review the rules for your use case
3. Deploy when ready:

```bash
firebase deploy --only firestore:rules
```

---

## PHASE 4: CONTEXT & STATE MANAGEMENT (Week 2)

### Step 4.1: Create Company Context

1. Copy content from `company-context.tsx`
2. Create `src/context/CompanyContext.tsx`
3. Update imports as needed

### Step 4.2: Create Auth Context

Create `src/context/AuthContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

export interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: Error | null;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsLoading(false);
    }, (err) => {
      setError(err);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Step 4.3: Wrap App with Providers

Update `src/App.tsx`:

```typescript
import { AuthProvider } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { useAuth } from './context/AuthContext';

function AppContent() {
  const { firebaseUser } = useAuth();

  return (
    <CompanyProvider userId={firebaseUser?.uid || null}>
      {/* Your app routes here */}
    </CompanyProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

---

## PHASE 5: AUTHENTICATION IMPLEMENTATION (Week 2-3)

### Step 5.1: Implement Auth Service

1. Copy `auth-service.ts` to `src/lib/firebase/auth.ts`
2. Update imports to match your project structure

### Step 5.2: Create Sign-Up Page

Create `src/features/auth/pages/SignUpPage.tsx`:

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignUpForm } from '../../../example-components';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <SignUpForm onSuccess={() => navigate('/dashboard')} />
    </div>
  );
};
```

### Step 5.3: Create Login Page

Create `src/features/auth/pages/LoginPage.tsx`:

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../../../lib/firebase/auth';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await loginUser(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};
```

---

## PHASE 6: QUERY & MUTATION LAYER (Week 3)

### Step 6.1: Implement Firestore Queries

1. Copy `query-examples.ts` to `src/lib/queries/index.ts`
2. Create custom hook files for each resource:

```typescript
// src/lib/queries/useInvoices.ts
import { useCompanyId } from '../context/CompanyContext';
import { getInvoicesByCompanyId } from './index';

export function useInvoices() {
  const companyId = useCompanyId();
  const [invoices, setInvoices] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    getInvoicesByCompanyId(companyId)
      .then(setInvoices)
      .finally(() => setIsLoading(false));
  }, [companyId]);

  return { invoices, isLoading };
}
```

### Step 6.2: Implement Mutations

Create `src/lib/mutations/index.ts`:

```typescript
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Invoice } from '../../types';

/**
 * Create invoice
 */
export async function createInvoice(companyId: string, data: Omit<Invoice, 'id' | 'createdAt'>) {
  const invoiceRef = doc(collection(db, 'invoices'));
  await setDoc(invoiceRef, {
    ...data,
    companyId, // ⭐ REQUIRED
    createdAt: serverTimestamp(),
  });
  return invoiceRef.id;
}

/**
 * Update invoice
 */
export async function updateInvoice(invoiceId: string, data: Partial<Invoice>) {
  const invoiceRef = doc(db, 'invoices', invoiceId);
  await updateDoc(invoiceRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete invoice
 */
export async function deleteInvoice(invoiceId: string) {
  const invoiceRef = doc(db, 'invoices', invoiceId);
  await deleteDoc(invoiceRef);
}
```

---

## PHASE 7: PERMISSION & ROLE-BASED ACCESS (Week 3-4)

### Step 7.1: Implement Permission System

1. Copy `permission-system.ts` to `src/lib/permissions/index.ts`
2. Create permission check HOC:

```typescript
// src/middleware/withPermission.tsx
import React from 'react';
import { useCurrentUser } from '../context/CompanyContext';
import { hasPermission } from '../lib/permissions';

interface RequirePermissionProps {
  resource: string;
  action: 'read' | 'write' | 'delete' | 'admin';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RequirePermission({
  resource,
  action,
  fallback,
  children,
}: RequirePermissionProps) {
  const user = useCurrentUser();

  if (!hasPermission(user.role, resource, action)) {
    return fallback ? <>{fallback}</> : <div>Access Denied</div>;
  }

  return <>{children}</>;
}
```

### Step 7.2: Use Permission Guards in Components

```typescript
import { RequirePermission } from '../middleware/withPermission';

export function AdminPanel() {
  return (
    <RequirePermission resource="users" action="admin">
      <UserManagement users={[]} />
    </RequirePermission>
  );
}
```

---

## PHASE 8: MIGRATION (Week 4)

### Step 8.1: Prepare Migration Script

1. Copy `migration-script.ts` to root folder or `functions/src/`
2. Update `MIGRATION_COMPANY_ID` to your default company ID
3. Install dependencies:

```bash
npm install --save-dev ts-node typescript
```

### Step 8.2: Run Migration (TEST FIRST!)

```bash
# Test run (check output without committing changes)
npx ts-node migration-script.ts

# Verify all documents have companyId
```

### Step 8.3: Verify Migration

```bash
# Check specific collection
firebase firestore:describe invoices
```

---

## PHASE 9: TESTING (Week 4)

### Step 9.1: Test Tenant Isolation

```typescript
// src/tests/tenantIsolation.test.ts
import { getInvoicesByCompanyId } from '../lib/queries';

describe('Tenant Isolation', () => {
  it('should never return documents from other companies', async () => {
    const company1Invoices = await getInvoicesByCompanyId('company-1');
    const company2Invoices = await getInvoicesByCompanyId('company-2');

    company1Invoices.forEach(invoice => {
      expect(invoice.companyId).toBe('company-1');
    });

    company2Invoices.forEach(invoice => {
      expect(invoice.companyId).toBe('company-2');
    });
  });

  it('should enforce security rules at Firestore level', async () => {
    // Try to read from another company (should fail)
    const otherCompanyRef = doc(db, 'companies', 'other-company-id');
    
    expect(async () => {
      await getDoc(otherCompanyRef);
    }).rejects.toThrow();
  });
});
```

### Step 9.2: Test Permissions

```typescript
describe('Permissions', () => {
  it('employees should not delete invoices', () => {
    const canDelete = hasPermission('employee', 'invoices', 'delete');
    expect(canDelete).toBe(false);
  });

  it('managers should delete invoices', () => {
    const canDelete = hasPermission('manager', 'invoices', 'delete');
    expect(canDelete).toBe(true);
  });
});
```

---

## PHASE 10: DEPLOYMENT (Week 5)

### Step 10.1: Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Migration successful
- [ ] Security rules reviewed and tested
- [ ] Cloud functions deployed
- [ ] No documents without companyId
- [ ] All queries include companyId filter
- [ ] Custom claims set for all users
- [ ] All env vars configured

### Step 10.2: Deploy in Stages

**Stage 1: Deploy to staging environment**
```bash
firebase deploy --project staging
```

**Stage 2: Monitor for issues**
- Check Cloud Function logs
- Verify security rules working
- Test tenant isolation

**Stage 3: Deploy to production**
```bash
firebase deploy --project production
```

### Step 10.3: Post-Deployment

- Monitor error rates
- Check custom claims in tokens
- Verify all queries returning correct data
- Test cross-tenant isolation with multiple users

---

## COMMON PATTERNS

### Pattern 1: Scoped Queries

```typescript
// ❌ WRONG - Missing companyId filter
const invoices = await db.collection('invoices').get();

// ✅ CORRECT
const { companyId } = useCompanyId();
const invoices = await db
  .collection('invoices')
  .where('companyId', '==', companyId)
  .get();
```

### Pattern 2: Creating Documents

```typescript
// ❌ WRONG - Forgetting companyId
await db.collection('invoices').add({
  amount: 100,
  // missing companyId!
});

// ✅ CORRECT
const companyId = useCompanyId();
await db.collection('invoices').add({
  amount: 100,
  companyId, // ⭐ REQUIRED
  createdAt: serverTimestamp(),
});
```

### Pattern 3: Permission Checks

```typescript
// ✅ CORRECT
import { RequirePermission } from './middleware/withPermission';

<RequirePermission resource="users" action="delete">
  <DeleteUserButton userId={userId} />
</RequirePermission>
```

### Pattern 4: Role-Based Features

```typescript
// ✅ CORRECT
import { useFeature } from '../context/CompanyContext';

export function AdvancedReportsPage() {
  const canUseAdvancedReports = useFeature('advancedReports');

  if (!canUseAdvancedReports) {
    return <UpgradePrompt />;
  }

  return <AdvancedReports />;
}
```

---

## TROUBLESHOOTING

### Issue: "User is not assigned to a company"

**Cause**: Custom claims not set OR user document missing companyId

**Solution**:
```typescript
// Manually set custom claims
const user = auth.currentUser;
await setUserCustomClaims(user.uid, {
  companyId: 'correct-company-id',
  role: 'admin',
  email: user.email,
});
```

### Issue: "Unauthorized: Document does not belong to your company"

**Cause**: Query returning documents from wrong company

**Solution**:
1. Check all queries include `where('companyId', '==', companyId)`
2. Verify companyId from context is correct
3. Check Firestore data - ensure all docs have companyId

### Issue: "Permission denied" on create

**Cause**: Document missing companyId or companyId doesn't match user's

**Solution**:
```typescript
// ✅ CORRECT - Always include user's companyId
const companyId = useCompanyId();
await createInvoice(companyId, {
  // ... invoice data
});
```

---

## NEXT STEPS

1. **Stripe Integration**: Add billing in companies collection
2. **Subdomain Support**: Route to correct company based on subdomain
3. **Advanced Reporting**: Add analytics per company
4. **API Keys**: Allow API access for enterprise plans
5. **SSO**: Implement single sign-on for enterprise
6. **Audit Logs**: Full audit trail of all changes per company

---

## SUPPORT RESOURCES

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Auth Custom Claims](https://firebase.google.com/docs/auth/admin-sdk-setup)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Multi-Tenant SaaS Patterns](https://firebase.google.com/docs/firestore/solutions/multi-tenant-applications)

---

## ADDITIONAL HELP

If you encounter issues:

1. Check Cloud Function logs: `firebase functions:log`
2. Review Firestore rules violations in Firebase Console
3. Check browser console for custom claims in auth token
4. Verify `companyId` is consistent across user document and custom claims
