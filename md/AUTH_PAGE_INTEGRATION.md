/**
 * HOW TO USE AUTH PAGE WITH COMPANY CREATION
 * Replace your login with this unified auth page
 */

// ============================================================================
// UPDATE YOUR ROUTES (in App.tsx or router file)
// ============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';              // ← NEW unified auth
import { Dashboard } from './pages/Dashboard';
import { CompanyProvider } from './context/CompanyContext';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES */}
        
        {/* Replace /login with /auth */}
        <Route path="/auth" element={<AuthPage />} />
        
        {/* Redirect root to auth */}
        <Route path="/" element={<Navigate to="/auth" replace />} />

        {/* PROTECTED ROUTES */}
        <Route
          path="/dashboard"
          element={
            <CompanyProvider>
              <Dashboard />
            </CompanyProvider>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ============================================================================
// UPDATE NAVIGATION/NAVBAR
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { useAuthContext } from './context/AuthContext';

export function Navigation() {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  return (
    <nav>
      {!user ? (
        <button onClick={() => navigate('/auth')}>
          Sign In / Create Company
        </button>
      ) : (
        <>
          <button onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button onClick={() => {/* logout */}}>Logout</button>
        </>
      )}
    </nav>
  );
}

// ============================================================================
// WHAT THE USER SEES
// ============================================================================

/*
UNIFIED AUTH PAGE (/auth)
┌─────────────────────────────────┐
│        [Sign In] [Create Company]  ← TABS |
├─────────────────────────────────┤
│                                 │
│ Sign In                         │
│ Access your company dashboard   │
│                                 │
│ Email:      [_______________]   │
│ Password:   [_______________]   │
│                                 │
│         [Sign In Button]        │
│    [Forgot password?]           │
│                                 │
└─────────────────────────────────┘

Click "Create Company" tab →

┌─────────────────────────────────┐
│        [Sign In] [Create Company]  ← TABS |
├─────────────────────────────────┤
│                                 │
│ Create Company                  │
│ Start your free account         │
│                                 │
│ Company Name: [_______________] │
│ Your Full Name: [_____________] │
│ Email:        [_______________] │
│ Password:     [_______________] │
│ Confirm Pwd:  [_______________] │
│                                 │
│      [Create Company Button]    │
│    [Terms of Service link]      │
│                                 │
└─────────────────────────────────┘
*/

// ============================================================================
// KEY FEATURES
// ============================================================================

/*
✅ TWO TABS:
   - Sign In: For existing users
   - Create Company: For new companies

✅ UNIFIED EXPERIENCE:
   - Same page for login and signup
   - Tab switching is instant
   - Error messages clear when switching tabs

✅ VALIDATION:
   - Email format check
   - Password strength validation
   - Required field checks
   - Real-time error messages

✅ STYLING:
   - Purple gradient background
   - White card centered on page
   - Responsive design
   - Smooth transitions

✅ FUNCTIONALITY:
   - Login: Calls loginUser(email, password)
   - Create: Calls signUpNewCompany(data)
   - Both auto-redirect to /dashboard

✅ ERROR HANDLING:
   - Shows error messages in red box
   - Error clears when switching tabs
   - Loading states during submission
*/

// ============================================================================
// INTEGRATION STEPS
// ============================================================================

/*
STEP 1: Copy File
  ├─ Copy auth-page.tsx to your src/pages/ folder
  └─ Rename if needed: src/pages/AuthPage.tsx

STEP 2: Update Routes
  ├─ Open your App.tsx or router file
  ├─ Replace /login route with /auth route (use code above)
  ├─ Point to AuthPage component
  └─ Update any links pointing to /login → /login redirects to /auth

STEP 3: Test
  ├─ Run: npm run dev
  ├─ Visit: http://localhost:5173/
  ├─ Should see auth page with two tabs
  ├─ Click "Create Company" tab
  ├─ Fill form and test creation
  └─ Verify redirect to dashboard

STEP 4: Cleanup
  ├─ Remove old separate login component (if you have one)
  ├─ Remove old create-company-page.tsx (not needed now)
  └─ Update any other files linking to old login page
*/

// ============================================================================
// MIGRATION FROM OLD PAGES
// ============================================================================

/*
BEFORE (Multiple Pages):
  ├─ /                → WelcomePage (choose login or create)
  ├─ /login           → LoginPage
  ├─ /create-company  → CreateCompanyPage
  └─ /dashboard       → Dashboard

AFTER (Unified Auth):
  ├─ /auth            → AuthPage (login OR create in tabs)
  ├─ /                → Redirects to /auth
  └─ /dashboard       → Dashboard

BENEFITS:
  ✓ Simpler routing
  ✓ Better user flow
  ✓ Consistent UI
  ✓ Fewer files
  ✓ Easier to maintain
*/

// ============================================================================
// CUSTOMIZATION
// ============================================================================

/*
Want to change colors?
  1. Find the `styles` object at bottom of auth-page.tsx
  2. Change these color values:
     - #667eea → your primary color
     - #764ba2 → your secondary color
     - '#1a1a1a' → your text color
  3. Save and refresh

Want to add "Terms & Privacy links"?
  Already included! See the <a> tags in both forms

Want to add "Remember Me" checkbox?
  Add this to login form:
  
  <div style={styles.formGroup}>
    <label>
      <input type="checkbox" name="rememberMe" />
      Remember me
    </label>
  </div>

Want to add "Sign up with Google"?
  Add buttons before the submit button:
  
  <button style={styles.socialButton}>
    Sign in with Google
  </button>
  <button style={styles.socialButton}>
    Sign in with GitHub
  </button>

Want form to submit on Enter key?
  Already works by default! Pressing Enter submits the form
*/

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

/*
PROBLEM: Tabs show but form doesn't display
SOLUTION: Check that auth-page.tsx is in correct location
          Make sure import path is correct in router

PROBLEM: Company creation fails
SOLUTION: Check browser console for error messages
          Verify auth-service.ts is imported correctly
          Check Firebase is configured
          Verif custom claims Cloud Function is deployed

PROBLEM: Can't login after creating company
SOLUTION: Check custom claims are set (use DevTools → Application → Storage)
          Clear browser cache/localStorage
          Check Firestore rules are deployed

PROBLEM: Styling looks wrong
SOLUTION: Some CSS resets might affect inline styles
          Add these to your base CSS if needed:
          
          input { 
            font-family: inherit;
            font-size: inherit;
          }
          button { 
            font-family: inherit;
          }

PROBLEM: Form is not responsive on mobile
SOLUTION: Already responsive! If not working:
          Check viewport meta tag in index.html:
          <meta name="viewport" content="width=device-width, initial-scale=1">

PROBLEM: Tab text is hard to read
SOLUTION: Change tab colors in styles.tab and styles.tabActive
*/

// ============================================================================
// TESTING CHECKLIST
// ============================================================================

/*
BEFORE GOING TO PRODUCTION:

[ ] AuthPage displays with two tabs (Sign In, Create Company)
[ ] Can switch between tabs
[ ] Sign In tab shows email/password fields
[ ] Create Company tab shows all required fields
[ ] Form validation works (errors on invalid input)
[ ] Login with existing account works
[ ] Company creation succeeds
[ ] User auto-redirects to dashboard after login
[ ] User auto-redirects to dashboard after company creation
[ ] Custom claims are set (check DevTools)
[ ] Only authenticated users can access /dashboard
[ ] Logout works
[ ] Refresh page maintains auth state
[ ] Mobile view is responsive
[ ] Error messages display correctly
[ ] Loading state shows during submission
[ ] Can't submit form twice simultaneously
[ ] Switching tabs clears previous errors
[ ] Links work (forgot password, terms, etc.)
[ ] Browser history works correctly (back button)
*/

// ============================================================================
// COMPARISON: WELCOME PAGE vs AUTH PAGE
// ============================================================================

/*
WELCOME PAGE APPROACH (Old):
  ├─ User visits /
  ├─ Sees WelcomePage with two large cards
  ├─ Clicks "Create Company" → /create-company
  ├─ Sees CreateCompanyPage form
  ├─ Fills form and creates company
  └─ Redirects to /dashboard

Problems:
  - More pages to navigate
  - Slower for returning users (must click twice)
  - More complex routing
  - Need to manage state across pages

AUTH PAGE APPROACH (New):
  ├─ User visits / (redirects to /auth)
  ├─ Sees AuthPage with two tabs
  ├─ Either login or create company on same page
  ├─ If creating: Fills form and creates company
  ├─ If logging in: Enters credentials
  └─ Redirects to /dashboard

Benefits:
  ✓ All auth on single page
  ✓ Faster for users
  ✓ Simpler routing
  ✓ Better UX
  ✓ Less code to maintain
  ✓ Unified styling

RECOMMENDATION: Use AuthPage approach (unified auth-page.tsx)
                Delete welcome-page.tsx and create-company-page.tsx
*/

export default AuthPage;
