/**
 * QUICK IMPLEMENTATION - GET UI WORKING NOW
 * Step-by-step to see auth page working
 */

# STEP 1: COPY FILES TO YOUR PROJECT
# ====================================

## Where your files should go:

```
Your Project Structure:
│
├── src/
│   ├── pages/                                    ← CREATE THIS FOLDER
│   │   ├── AuthPage.tsx                         ← COPY auth-page.tsx HERE
│   │   └── Dashboard.tsx                        ← Your existing dashboard
│   │
│   ├── context/                                 ← CREATE IF NOT EXISTS
│   │   ├── AuthContext.tsx                      ← Your auth context
│   │   └── CompanyContext.tsx                   ← Copy company-context.tsx HERE
│   │
│   ├── lib/
│   │   ├── firebase/
│   │   │   └── auth.ts                          ← Copy auth-service.ts HERE
│   │   └── queries/
│   │       └── ...query files
│   │
│   ├── types/
│   │   └── multi-tenant.ts                      ← Copy types-multi-tenant.ts HERE
│   │
│   ├── App.tsx                                  ← UPDATE THIS (see below)
│   └── index.tsx                                ← Usually here already
│
├── public/
├── package.json
└── vite.config.ts
```

---

# STEP 2: CREATE/UPDATE YOUR App.tsx
# ===================================

Replace your current App.tsx with this:

```typescript
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { AuthProvider } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* AUTH PAGE - Login & Create Company */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<Navigate to="/auth" replace />} />

          {/* DASHBOARD - Protected */}
          <Route
            path="/dashboard"
            element={
              <CompanyProvider>
                <Dashboard />
              </CompanyProvider>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

---

# STEP 3: FILE COPY COMMANDS
# ==========================

Use PowerShell to copy files (run from your project root):

```powershell
# Create folders
New-Item -ItemType Directory -Path "src/pages" -Force
New-Item -ItemType Directory -Path "src/context" -Force
New-Item -ItemType Directory -Path "src/lib/firebase" -Force
New-Item -ItemType Directory -Path "src/types" -Force

# Copy files
Copy-Item "auth-page.tsx" "src/pages/AuthPage.tsx"
Copy-Item "company-context.tsx" "src/context/CompanyContext.tsx"
Copy-Item "auth-service.ts" "src/lib/firebase/auth.ts"
Copy-Item "types-multi-tenant.ts" "src/types/multi-tenant.ts"
```

---

# STEP 4: UPDATE YOUR IMPORTS
# ============================

In **auth-page.tsx**, you may need to update the import paths:

Current:
```typescript
import { signUpNewCompany, loginUser } from '../../lib/firebase/auth';
import type { SignUpData } from '../../types/multi-tenant';
```

If AuthPage is in `src/pages/`, these paths should be correct.
If not, adjust:
- `../../` means go up 2 folders
- `../` means go up 1 folder

---

# STEP 5: RUN YOUR APP
# ====================

```bash
npm run dev
```

Then visit: **http://localhost:5173/**

You should see:
- Purple gradient background
- White card in center
- Apple logo 🍎 at top
- "Fruits For You" company name
- Two tabs: "Sign In" and "Create Company"
- Login form visible

---

# STEP 6: TEST IT
# ===============

### Test Sign In Tab:
1. Click "Sign In" tab
2. Enter test email and password
3. Click "Sign In" button
4. (May fail if no account exists - that's normal)

### Test Create Company Tab:
1. Click "Create Company" tab
2. Fill in all fields:
   - Company Name: "Test Company"
   - Full Name: "John Doe"
   - Email: "test@example.com"
   - Password: "Password123"
   - Confirm Password: "Password123"
3. Click "Create Company"
4. Should redirect to /dashboard (if Firebase is set up)

---

# COMMON ISSUES & FIXES
# =====================

## Issue: Import errors
```
"Cannot find module 'src/pages/AuthPage'"
```
**Fix:** Check file paths match your folder structure

## Issue: AuthPage doesn't show
```
Blank page or error on /auth
```
**Fix:** 
1. Check browser console (F12 → Console tab)
2. Verify App.tsx routes are correct
3. Check AuthPage.tsx is in src/pages/

## Issue: "Cannot find AuthContext"
```
"Module not found: 'AuthContext'"
```
**Fix:** Create your AuthContext.tsx file or check import path

## Issue: Styling looks broken
```
Colors wrong, layout messed up
```
**Fix:** Inline styles are applied. Check no CSS is overriding them.
Add to your base CSS:
```css
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  padding: 0;
}
```

## Issue: Firebase functions not working
```
"signUpNewCompany is not a function"
```
**Fix:** 
1. Check auth-service.ts is copied to src/lib/firebase/auth.ts
2. Check your Firebase config is correct
3. Check Cloud Functions are deployed

---

# QUICK CHECKLIST
# ================

- [ ] Created src/pages folder
- [ ] Created src/context folder
- [ ] Created src/lib/firebase folder
- [ ] Created src/types folder
- [ ] Copied auth-page.tsx → src/pages/AuthPage.tsx
- [ ] Copied company-context.tsx → src/context/CompanyContext.tsx
- [ ] Copied auth-service.ts → src/lib/firebase/auth.ts
- [ ] Copied types-multi-tenant.ts → src/types/multi-tenant.ts
- [ ] Updated App.tsx with new router
- [ ] Ran `npm run dev`
- [ ] Visited http://localhost:5173/
- [ ] See auth page with logo and tabs
- [ ] Form appears when switching tabs

---

# CURRENT vs DESIRED STATE
# =========================

CURRENT (Before Integration):
```
You have template files sitting in workspace root
But your app doesn't use them yet
No UI changes visible
```

DESIRED (After Integration):
```
Files copied to proper src/ locations
App.tsx updated to use new routing
Visit localhost:5173/
See branded auth page with logo
Can login or create company
Auto-redirects to dashboard
```

---

# NEXT AFTER UI WORKS
# ====================

Once you see the auth page working:
1. Test company creation flow
2. Deploy Firestore rules
3. Deploy Cloud Functions
4. Create migrations if needed
5. Update existing pages to use company context
6. Test complete flow: create company → see dashboard

---

# FILES READY TO USE
# ===================

✅ auth-page.tsx - In your workspace root
✅ company-context.tsx - In your workspace root
✅ auth-service.ts - In your workspace root
✅ types-multi-tenant.ts - In your workspace root

All are **ready to copy and use right now**

---

# POWERSHELL COMMANDS (All at Once)
# ==================================

Copy-paste this entire block into PowerShell (from project root):

```powershell
# Create all folders
New-Item -ItemType Directory -Path "src/pages" -Force | Out-Null
New-Item -ItemType Directory -Path "src/context" -Force | Out-Null
New-Item -ItemType Directory -Path "src/lib/firebase" -Force | Out-Null
New-Item -ItemType Directory -Path "src/types" -Force | Out-Null

# Copy files
Copy-Item "auth-page.tsx" "src/pages/AuthPage.tsx" -Force
Copy-Item "company-context.tsx" "src/context/CompanyContext.tsx" -Force
Copy-Item "auth-service.ts" "src/lib/firebase/auth.ts" -Force
Copy-Item "types-multi-tenant.ts" "src/types/multi-tenant.ts" -Force

Write-Host "✅ Files copied successfully!" -ForegroundColor Green
Write-Host "📝 Next: Update your App.tsx with new router" -ForegroundColor Yellow
Write-Host "▶️  Then run: npm run dev" -ForegroundColor Yellow
```

---

# EXPECTED RESULT AFTER STEPS
# =============================

When you run `npm run dev` and visit `http://localhost:5173/`:

```
╔════════════════════════════════════╗
║  [Purple Gradient Background]      ║
║                                    ║
║    ┌──────────────────────────┐   ║
║    │      🍎                  │   ║
║    │  Fruits For You          │   ║
║    ├──────────────────────────┤   ║
║    │ Sign In  Create Company  │   ║
║    ├──────────────────────────┤   ║
║    │                          │   ║
║    │ Sign in to your account  │   ║
║    │ Welcome back!...         │   ║
║    │                          │   ║
║    │ Email Address            │   ║
║    │ [__________________]     │   ║
║    │                          │   ║
║    │ Password                 │   ║
║    │ [__________________]     │   ║
║    │                          │   ║
║    │      [Sign In]           │   ║
║    │   Forgot password?       │   ║
║    │                          │   ║
║    └──────────────────────────┘   ║
║                                    ║
╚════════════════════════════════════╝
```

If you see this ✅ **Your UI is working!**

---

# AFTER UI WORKS - NEXT PHASE
# =============================

1. **Test Company Creation**
   - Click "Create Company" tab
   - Fill form with test data
   - Click button

2. **Deploy Firebase Rules** 
   - Copy firestore-rules-multi-tenant.txt content
   - Deploy to Firebase Console

3. **Deploy Cloud Functions**
   - Copy cloud-functions-multi-tenant.ts
   - Deploy to Firebase

4. **Migrate Existing Data** (if you have existing data)
   - Run migration-script.ts
   - Verify all documents have companyId

5. **Update Dashboard**
   - Integrate company context
   - Use useCompanyId() hook
   - Filter all queries by company

---

**READY TO START?** Follow the PowerShell commands above! 🚀
