/**
 * Company Context for Multi-Tenant Architecture
 * Provides company and user information throughout the app
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Company, User, CompanyContextType } from '../types/multi-tenant';

// Create the context
export const CompanyContext = createContext<CompanyContextType | null>(null);

interface CompanyProviderProps {
  children: React.ReactNode;
  userId: string | null; // Firebase UID
}

/**
 * CompanyProvider - wraps app with company context
 * Should be placed after auth provider
 */
export function CompanyProvider({ children, userId }: CompanyProviderProps) {
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load user and company on mount or when userId changes
   */
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      setCurrentUser(null);
      setCurrentCompany(null);
      return;
    }

    const loadUserAndCompany = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch user document
        const userRef = doc(db, 'users', userId);
        const userSnapshot = await getDoc(userRef);

        if (!userSnapshot.exists()) {
          throw new Error('User profile not found');
        }

        const userData = userSnapshot.data() as User;
        setCurrentUser(userData);

        const companyId = userData.companyId;

        if (!companyId) {
          throw new Error('User is not assigned to a company');
        }

        setCurrentCompanyId(companyId);

        // Fetch company document
        const companyRef = doc(db, 'companies', companyId);
        const companySnapshot = await getDoc(companyRef);

        if (!companySnapshot.exists()) {
          throw new Error('Company not found');
        }

        const companyData = companySnapshot.data() as Company;
        setCurrentCompany(companyData);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        console.error('Failed to load user/company:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserAndCompany();
  }, [userId]);

  /**
   * Refresh company data
   */
  const refreshCompany = async () => {
    if (!currentCompanyId) return;

    try {
      const companyRef = doc(db, 'companies', currentCompanyId);
      const snapshot = await getDoc(companyRef);

      if (snapshot.exists()) {
        setCurrentCompany(snapshot.data() as Company);
      }
    } catch (err) {
      console.error('Failed to refresh company:', err);
    }
  };

  const value: CompanyContextType = {
    currentCompanyId,
    currentCompany,
    currentUser,
    isLoading,
    error,
    setCurrentCompanyId,
    refreshCompany,
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

/**
 * Hook to use company context
 */
export function useCompany() {
  const context = useContext(CompanyContext);

  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider');
  }

  return context;
}

/**
 * Hook to get company ID only
 */
export function useCompanyId() {
  const { currentCompanyId } = useCompany();

  if (!currentCompanyId) {
    throw new Error('User is not assigned to a company');
  }

  return currentCompanyId;
}

/**
 * Hook to get current user
 */
export function useCurrentUser() {
  const { currentUser } = useCompany();

  if (!currentUser) {
    throw new Error('User not loaded');
  }

  return currentUser;
}

/**
 * Hook to check user role
 */
export function useUserRole() {
  const user = useCurrentUser();
  return user.role;
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin() {
  const role = useUserRole();
  return role === 'admin';
}

/**
 * Hook to check if user is manager or admin
 */
export function useIsManager() {
  const role = useUserRole();
  return role === 'admin' || role === 'manager';
}

/**
 * Hook to get current company
 */
export function useCurrentCompany() {
  const { currentCompany } = useCompany();

  if (!currentCompany) {
    throw new Error('Company not loaded');
  }

  return currentCompany;
}

/**
 * Hook to check subscription plan
 */
export function useSubscriptionPlan() {
  const company = useCurrentCompany();
  return company.subscriptionPlan;
}

/**
 * Hook to check if feature is available
 */
export function useFeature(featureKey: string) {
  const company = useCurrentCompany();
  const plan = company.subscriptionPlan;

  const features = {
    advancedReports: ['pro', 'enterprise'].includes(plan),
    apiAccess: plan === 'enterprise',
    customBranding: plan === 'enterprise',
    dedicatedSupport: plan === 'enterprise',
    twoFactorAuth: ['pro', 'enterprise'].includes(plan),
    sso: plan === 'enterprise',
  };

  return (features as Record<string, boolean>)[featureKey] || false;
}

/**
 * Hook to check company status
 */
export function useCompanyStatus() {
  const company = useCurrentCompany();
  return company.status;
}

/**
 * Hook to check if company is active
 */
export function useIsCompanyActive() {
  const status = useCompanyStatus();
  return status === 'active';
}
