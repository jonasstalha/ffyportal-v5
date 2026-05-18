/**
 * Firestore Query Examples for Multi-Tenant Architecture
 * All queries MUST include companyId filter for tenant isolation
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  QueryConstraint,
  DocumentData,
  QuerySnapshot,
  Timestamp,
  FieldValue,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Invoice, Client, ProductionReport, User } from '../types/multi-tenant';

// ============================================================================
// COMPANIES QUERIES
// ============================================================================

/**
 * Get single company by ID
 */
export async function getCompanyById(companyId: string) {
  const companyRef = doc(db, 'companies', companyId);
  const snapshot = await getDoc(companyRef);
  
  if (!snapshot.exists()) {
    throw new Error(`Company ${companyId} not found`);
  }

  return snapshot.data();
}

/**
 * Get company onboarding status
 */
export async function getCompanyOnboardingStatus(companyId: string) {
  const company = await getCompanyById(companyId);
  
  return {
    hasProfileInfo: !!company.name,
    hasLogoUrl: !!company.metadata?.logoUrl,
    hasTeamMembers: true, // Check separately
    hasIntegrations: !!company.metadata?.stripeCustomerId,
  };
}

// ============================================================================
// USERS QUERIES
// ============================================================================

/**
 * Get single user by ID
 */
export async function getUserById(userId: string) {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);
  
  if (!snapshot.exists()) {
    throw new Error(`User ${userId} not found`);
  }

  return snapshot.data() as User;
}

/**
 * Get all active users in a company
 * ⭐ IMPORTANT: Filters by companyId
 */
export async function getUsersByCompanyId(companyId: string) {
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as User);
}

/**
 * Get user count in company
 */
export async function getUserCountByCompanyId(companyId: string) {
  const users = await getUsersByCompanyId(companyId);
  return users.length;
}

/**
 * Get admins in company
 */
export async function getAdminsByCompanyId(companyId: string) {
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('role', '==', 'admin'),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as User);
}

/**
 * Get user by email within company
 */
export async function getUserByEmailInCompany(companyId: string, email: string) {
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('email', '==', email)
  );

  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as User;
}

// ============================================================================
// INVOICES QUERIES
// ============================================================================

/**
 * Get all invoices for a company
 * ⭐ IMPORTANT: Filters by companyId
 */
export async function getInvoicesByCompanyId(companyId: string) {
  const invoicesRef = collection(db, 'invoices');
  const q = query(
    invoicesRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
}

/**
 * Get invoices by status and company
 */
export async function getInvoicesByStatus(companyId: string, status: string) {
  const invoicesRef = collection(db, 'invoices');
  const q = query(
    invoicesRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
}

/**
 * Get invoices created by user in company
 */
export async function getInvoicesByUser(companyId: string, userId: string) {
  const invoicesRef = collection(db, 'invoices');
  const q = query(
    invoicesRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
}

/**
 * Get invoices for specific client in company
 */
export async function getInvoicesByClient(companyId: string, clientId: string) {
  const invoicesRef = collection(db, 'invoices');
  const q = query(
    invoicesRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
}

/**
 * Get invoices by date range for company
 */
export async function getInvoicesByDateRange(
  companyId: string,
  startDate: Date,
  endDate: Date
) {
  const invoicesRef = collection(db, 'invoices');
  const q = query(
    invoicesRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate)),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
}

/**
 * Get single invoice (with company verification)
 */
export async function getInvoiceById(companyId: string, invoiceId: string) {
  const invoiceRef = doc(db, 'invoices', invoiceId);
  const snapshot = await getDoc(invoiceRef);

  if (!snapshot.exists()) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const invoice = snapshot.data() as Invoice;

  // SECURITY: Verify company ownership
  if (invoice.companyId !== companyId) {
    throw new Error('Unauthorized: Invoice does not belong to your company');
  }

  return invoice;
}

// ============================================================================
// CLIENTS QUERIES
// ============================================================================

/**
 * Get all clients for a company
 * ⭐ IMPORTANT: Filters by companyId
 */
export async function getClientsByCompanyId(companyId: string) {
  const clientsRef = collection(db, 'clients');
  const q = query(
    clientsRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
}

/**
 * Get client by ID with company verification
 */
export async function getClientById(companyId: string, clientId: string) {
  const clientRef = doc(db, 'clients', clientId);
  const snapshot = await getDoc(clientRef);

  if (!snapshot.exists()) {
    throw new Error(`Client ${clientId} not found`);
  }

  const client = snapshot.data() as Client;

  // SECURITY: Verify company ownership
  if (client.companyId !== companyId) {
    throw new Error('Unauthorized: Client does not belong to your company');
  }

  return client;
}

/**
 * Search clients by name in company
 */
export async function searchClientsByName(companyId: string, searchTerm: string) {
  const clientsRef = collection(db, 'clients');
  const q = query(
    clientsRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(q);
  
  // Client-side filtering for search (Firestore doesn't support LIKE queries)
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Client))
    .filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
}

// ============================================================================
// PRODUCTION REPORTS QUERIES
// ============================================================================

/**
 * Get all production reports for company
 * ⭐ IMPORTANT: Filters by companyId
 */
export async function getReportsByCompanyId(companyId: string) {
  const reportsRef = collection(db, 'productionReports');
  const q = query(
    reportsRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('status', '==', 'completed'),
    orderBy('reportDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionReport));
}

/**
 * Get draft reports for company
 */
export async function getDraftReportsByCompanyId(companyId: string) {
  const reportsRef = collection(db, 'productionReports');
  const q = query(
    reportsRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('status', '==', 'draft')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionReport));
}

// ============================================================================
// EXPORTS QUERIES
// ============================================================================

/**
 * Get all exports for company
 */
export async function getExportsByCompanyId(companyId: string) {
  const exportsRef = collection(db, 'exports');
  const q = query(
    exportsRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get completed exports for download
 */
export async function getCompletedExportsByCompanyId(companyId: string) {
  const exportsRef = collection(db, 'exports');
  const q = query(
    exportsRef,
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    where('status', '==', 'completed'),
    orderBy('completedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============================================================================
// PAGINATION HELPERS
// ============================================================================

/**
 * Get paginated results with cursor
 */
export async function getPaginatedQuery(
  companyId: string,
  collectionName: string,
  constraints: QueryConstraint[],
  pageSize: number = 20,
  cursor?: DocumentData
) {
  const ref = collection(db, collectionName);
  const baseConstraints = [
    where('companyId', '==', companyId),      // ⭐ TENANT FILTER
    ...constraints,
  ];

  let q;
  if (cursor) {
    q = query(
      ref,
      ...baseConstraints,
      startAfter(cursor),
      limit(pageSize + 1) // Get one extra to check if more results exist
    );
  } else {
    q = query(
      ref,
      ...baseConstraints,
      limit(pageSize + 1)
    );
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs.map(doc => doc.data());

  return {
    items: docs.slice(0, pageSize),
    nextCursor: docs.length > pageSize ? docs[pageSize - 1] : null,
    hasMore: docs.length > pageSize,
  };
}

// ============================================================================
// AGGREGATION HELPERS
// ============================================================================

/**
 * Get invoice statistics
 */
export async function getInvoiceStats(companyId: string) {
  const invoices = await getInvoicesByCompanyId(companyId);

  return {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    pending: invoices.filter(i => i.status === 'sent').length,
    draft: invoices.filter(i => i.status === 'draft').length,
    totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0),
    paidAmount: invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0),
  };
}

/**
 * Get client statistics
 */
export async function getClientStats(companyId: string) {
  const clients = await getClientsByCompanyId(companyId);
  return {
    total: clients.length,
    active: clients.filter(c => c.status === 'active').length,
  };
}
