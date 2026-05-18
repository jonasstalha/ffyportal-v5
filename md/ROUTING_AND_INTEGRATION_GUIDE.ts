/**
 * ROUTING SETUP GUIDE
 * How to integrate the new company creation pages into your app
 */

// ============================================================================
// STEP 1: Add Routes to your main App.tsx or Router
// ============================================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WelcomePage } from './pages/WelcomePage';
import { CreateCompanyPage } from './pages/CreateCompanyPage';
import { JoinCompanyPage } from './pages/JoinCompanyPage';
import { LoginPage } from './pages/LoginPage'; // Your existing login
import { Dashboard } from './pages/Dashboard'; // Your existing dashboard
import { CompanyProvider } from './context/CompanyContext';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes - no auth required */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/create-company" element={<CreateCompanyPage />} />
        <Route path="/join-company" element={<JoinCompanyPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes - auth required */}
        <Route
          path="/dashboard"
          element={
            <CompanyProvider>
              <Dashboard />
            </CompanyProvider>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

// ============================================================================
// STEP 2: Authentication Guard (Optional but Recommended)
// ============================================================================

import { ReactNode } from 'react';
import { useAuthContext } from './context/AuthContext'; // Your auth context

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuthContext();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Usage in Routes:
// <Route
//   path="/dashboard"
//   element={
//     <ProtectedRoute>
//       <CompanyProvider>
//         <Dashboard />
//       </CompanyProvider>
//     </ProtectedRoute>
//   }
// />

// ============================================================================
// STEP 3: Update your existing LoginPage (if not multi-tenant)
// ============================================================================

/*
If you have an existing LoginPage, you may want to add a link to create a company:

import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      {/* Your existing login form */}
      
      <p>
        Don't have an account?{' '}
        <button onClick={() => navigate('/create-company')}>
          Create company
        </button>
      </p>
    </div>
  );
};
*/

// ============================================================================
// STEP 4: Update your App.tsx Entry Point
// ============================================================================

/*
// In your main App.tsx or index.tsx:

import { AuthProvider } from './context/AuthContext';
import { AppRouter } from './router/AppRouter';

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
*/

// ============================================================================
// STEP 5: Navbar/Navigation Updates
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { useAuthContext } from './context/AuthContext';

export const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  return (
    <nav>
      <button onClick={() => navigate('/')}>Home</button>

      {!user ? (
        <>
          <button onClick={() => navigate('/login')}>Sign In</button>
          <button onClick={() => navigate('/create-company')}>Create Company</button>
        </>
      ) : (
        <>
          <button onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button onClick={() => {/* logout logic */}}>Logout</button>
        </>
      )}
    </nav>
  );
};

// ============================================================================
// STEP 6: OnSuccess Handlers
// ============================================================================

/*
After company creation or joining, you have two options:

OPTION A: Redirect via navigate (automatic)
  The component uses: navigate('/dashboard')
  
OPTION B: Use onSuccess callback
  <CreateCompanyPage 
    onSuccess={() => {
      // Custom logic here
      navigate('/onboarding');
    }} 
  />

OPTION C: Add localStorage flag for onboarding
  In auth-service.ts signUpNewCompany(), add:
  localStorage.setItem('isNewCompany', 'true');
  
  Then in Dashboard:
  useEffect(() => {
    if (localStorage.getItem('isNewCompany')) {
      navigate('/onboarding');
      localStorage.removeItem('isNewCompany');
    }
  }, []);
*/

// ============================================================================
// STEP 7: File Structure
// ============================================================================

/*
After adding these components, your folder structure should look like:

src/
├── pages/
│   ├── WelcomePage.tsx                 (NEW)
│   ├── CreateCompanyPage.tsx           (NEW)
│   ├── JoinCompanyPage.tsx             (from example-components.tsx)
│   ├── LoginPage.tsx                   (existing)
│   └── Dashboard.tsx                   (existing)
├── context/
│   ├── AuthContext.tsx                 (existing)
│   └── CompanyContext.tsx              (from company-context.tsx)
├── lib/
│   ├── firebase/
│   │   └── auth.ts                     (from auth-service.ts)
│   └── queries/
│       └── ...query files
├── router/
│   └── AppRouter.tsx                   (NEW - use code from STEP 1)
└── App.tsx                             (update with AppRouter)
*/

// ============================================================================
// STEP 8: Authentication Flow Summary
// ============================================================================

/*
UNAUTHENTICATED USER FLOW:
  1. Visit "/" → WelcomePage
  2. Click "Create Company" → CreateCompanyPage
  3. Fill form → signUpNewCompany()
  4. Firebase Auth user created
  5. Company doc created
  6. User doc created with companyId
  7. Custom claims set {companyId, role: 'admin', email}
  8. Auto login & redirect → /dashboard
  9. CompanyProvider loads company context
  10. User sees dashboard

INVITED USER FLOW:
  1. Receive invite link with code
  2. Click link → JoinCompanyPage
  3. Enter code → signUpWithInvitation()
  4. Firebase Auth user created
  5. User doc created with invited role
  6. Custom claims set {companyId, role: 'manager'|'employee', email}
  7. Auto login & redirect → /dashboard
  8. CompanyProvider loads company context
  9. User sees dashboard (permissions limited by role)

RETURNING USER FLOW:
  1. Visit "/" or "/login"
  2. Click "Sign In" → LoginPage
  3. Enter credentials → loginUser()
  4. Firebase Auth + custom claims fetched
  5. Redirect → /dashboard
  6. CompanyProvider loads company context
  7. User sees dashboard
*/

// ============================================================================
// STEP 9: Error Handling
// ============================================================================

/*
Common errors and how to handle them:

ERROR: "Email already in use"
CAUSE: User with email already exists
FIX: Redirect to login page with message

ERROR: "Invalid invitation code"
CAUSE: Code is wrong, expired, or doesn't exist
FIX: Show error message, let them try again

ERROR: "Company name required"
CAUSE: User skipped step 1
FIX: Form validation prevents this (handled in component)

ERROR: "Password too weak"
CAUSE: Password doesn't meet requirements
FIX: Show requirements, let user correct and retry

ERROR: "Passwords don't match"
CAUSE: Mismatch in password fields
FIX: Show error, let user correct

ERROR: "Custom claims not set"
CAUSE: Cloud Function failed
FIX: Retry logic, contact support if persistent
*/

// ============================================================================
// STEP 10: Testing Checklist
// ============================================================================

/*
BEFORE DEPLOYING:

[ ] WelcomePage displays correctly
[ ] CreateCompanyPage accepts form input
[ ] Company creation succeeds
[ ] User is logged in after creation
[ ] Custom claims are set
[ ] CompanyProvider loads company data
[ ] User can see dashboard
[ ] Logout works
[ ] Login with existing account works
[ ] JoinCompanyPage accepts invitation code
[ ] User joined with correct role
[ ] Permission checks work (Employee can't delete, Admin can)
[ ] Firestore rules enforce companyId filtering
[ ] Navigation between pages works
[ ] Mobile responsive design works
[ ] Error messages display correctly
[ ] Loading states show during operations

SECURITY TESTS:

[ ] User from Company A cannot see Company B data
[ ] Custom claims match Firestore rules
[ ] Invitation codes are one-time use
[ ] Expired invitations are rejected
[ ] Users with role 'employee' cannot modify data
*/

export default AppRouter;
