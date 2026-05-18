/**
 * Firebase Cloud Functions for Multi-Tenant Architecture
 * These functions handle backend operations that require admin privileges
 * 
 * Deploy with: firebase deploy --only functions
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CallableContext } from 'firebase-functions/v1/https';

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// ============================================================================
// CUSTOM CLAIMS MANAGEMENT
// ============================================================================

/**
 * Cloud Function: Set custom claims for a user
 * Called during signup/company creation
 * 
 * Usage:
 * const setCustomClaimsFunction = httpsCallable(functions, 'setCustomUserClaims');
 * await setCustomClaimsFunction({ uid, claims: { companyId, role, email } });
 */
export const setCustomUserClaims = functions.https.onCall(
  async (data, context: CallableContext) => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { uid, claims } = data;

    // Validate input
    if (!uid || typeof uid !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'uid is required and must be a string'
      );
    }

    if (!claims || typeof claims !== 'object') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'claims is required and must be an object'
      );
    }

    const { companyId, role, email } = claims;

    if (!companyId || !role || !email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'claims must contain companyId, role, and email'
      );
    }

    // Security: Only allow users to set claims for themselves during signup
    // Or allow company admins to set for others
    if (uid !== context.auth.uid) {
      // Check if caller is company admin
      const userDoc = await db.collection('users').doc(context.auth.uid).get();

      if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only admins can set claims for other users'
        );
      }

      // Verify both users are in the same company
      const targetUserDoc = await db.collection('users').doc(uid).get();
      if (targetUserDoc.data()?.companyId !== userDoc.data()?.companyId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Cannot modify users in other companies'
        );
      }
    }

    try {
      await auth.setCustomUserClaims(uid, {
        companyId,
        role,
        email,
      });

      return { success: true, message: `Custom claims set for user ${uid}` };
    } catch (error) {
      console.error('Error setting custom claims:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to set custom claims'
      );
    }
  }
);

/**
 * Cloud Function: Clear custom claims (admin only)
 */
export const clearCustomUserClaims = functions.https.onCall(
  async (data, context: CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Verify caller is admin
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can clear claims'
      );
    }

    const { uid } = data;

    try {
      await auth.setCustomUserClaims(uid, {});
      return { success: true, message: `Custom claims cleared for user ${uid}` };
    } catch (error) {
      console.error('Error clearing custom claims:', error);
      throw new functions.https.HttpsError('internal', 'Failed to clear claims');
    }
  }
);

// ============================================================================
// COMPANY MANAGEMENT
// ============================================================================

/**
 * Cloud Function: Create new company
 * Called during user signup for new company
 */
export const createCompany = functions.https.onCall(
  async (data, context: CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { companyName } = data;

    if (!companyName || typeof companyName !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'companyName is required'
      );
    }

    try {
      // Create company document
      const companyRef = await db.collection('companies').add({
        name: companyName,
        ownerId: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        subscriptionPlan: 'free',
        status: 'active',
      });

      return {
        success: true,
        companyId: companyRef.id,
      };
    } catch (error) {
      console.error('Error creating company:', error);
      throw new functions.https.HttpsError('internal', 'Failed to create company');
    }
  }
);

/**
 * Cloud Function: Update company subscription
 * Called when subscription changes (via Stripe webhook)
 */
export const updateCompanySubscription = functions.https.onCall(
  async (data, context: CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { companyId, subscriptionPlan, stripeCustomerId } = data;

    // Verify user is admin of the company
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can update subscription'
      );
    }

    if (userDoc.data()?.companyId !== companyId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Cannot update other companies'
      );
    }

    try {
      await db.collection('companies').doc(companyId).update({
        subscriptionPlan,
        metadata: {
          stripeCustomerId,
          subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw new functions.https.HttpsError('internal', 'Failed to update subscription');
    }
  }
);

// ============================================================================
// USER INVITATION MANAGEMENT
// ============================================================================

/**
 * Cloud Function: Send invitation to join company
 */
export const sendCompanyInvitation = functions.https.onCall(
  async (data, context: CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { companyId, invitedEmail, role } = data;

    // Verify sender is admin
    const senderDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!senderDoc.exists || senderDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can send invitations'
      );
    }

    if (senderDoc.data()?.companyId !== companyId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot invite to other companies');
    }

    // Validate role
    if (!['admin', 'manager', 'employee'].includes(role)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid role');
    }

    try {
      // Generate invitation code
      const inviteCode = generateInviteCode();

      // Save invitation to subcollection
      const invitationRef = await db
        .collection('companies')
        .doc(companyId)
        .collection('invitations')
        .add({
          email: invitedEmail,
          role,
          status: 'pending',
          inviteCode,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          invitedBy: context.auth.uid,
        });

      // TODO: Send email to invitedEmail with invitation link
      // const invitationLink = `https://app.example.com/join?code=${inviteCode}`;
      // await sendInvitationEmail(invitedEmail, invitationLink);

      return {
        success: true,
        invitationId: invitationRef.id,
        inviteCode,
      };
    } catch (error) {
      console.error('Error sending invitation:', error);
      throw new functions.https.HttpsError('internal', 'Failed to send invitation');
    }
  }
);

/**
 * Cloud Function: Revoke invitation
 */
export const revokeInvitation = functions.https.onCall(
  async (data, context: CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { companyId, invitationId } = data;

    // Verify user is admin
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can revoke invitations');
    }

    try {
      await db
        .collection('companies')
        .doc(companyId)
        .collection('invitations')
        .doc(invitationId)
        .delete();

      return { success: true };
    } catch (error) {
      console.error('Error revoking invitation:', error);
      throw new functions.https.HttpsError('internal', 'Failed to revoke invitation');
    }
  }
);

/**
 * Cloud Function: Remove user from company
 */
export const removeUserFromCompany = functions.https.onCall(
  async (data, context: CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { companyId, userId } = data;

    // Verify caller is admin
    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can remove users');
    }

    if (callerDoc.data()?.companyId !== companyId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot remove from other companies');
    }

    // Prevent removing yourself (or at least the company owner)
    const company = await db.collection('companies').doc(companyId).get();
    if (company.data()?.ownerId === userId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Cannot remove company owner. Transfer ownership first.'
      );
    }

    try {
      // Soft delete by marking as inactive
      await db.collection('users').doc(userId).update({
        status: 'inactive',
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Clear custom claims
      await auth.setCustomUserClaims(userId, {});

      return { success: true };
    } catch (error) {
      console.error('Error removing user:', error);
      throw new functions.https.HttpsError('internal', 'Failed to remove user');
    }
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate random invitation code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Send invitation email (implement with Sendgrid, Mailgun, etc.)
 */
async function sendInvitationEmail(email: string, invitationLink: string) {
  // TODO: Implement email sending
  console.log(`Sending invitation to ${email}: ${invitationLink}`);
}

// ============================================================================
// DATABASE TRIGGERS
// ============================================================================

/**
 * Trigger: Auto-generate user display data when created
 */
export const onUserCreate = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snapshot, context) => {
    const userId = context.params.userId;
    const userData = snapshot.data();

    // Add default metadata if not present
    if (!userData.metadata) {
      await snapshot.ref.update({
        metadata: {
          language: 'en',
          timezone: 'UTC',
          preferences: {
            emailNotifications: true,
            smsNotifications: false,
            darkMode: false,
            pageSize: 25,
          },
        },
      });
    }

    console.log(`User created: ${userId}`);
  });

/**
 * Trigger: Clean up when company is deleted
 */
export const onCompanyDelete = functions.firestore
  .document('companies/{companyId}')
  .onDelete(async (snapshot, context) => {
    const companyId = context.params.companyId;

    // Soft-delete all associated users
    const usersSnapshot = await db
      .collection('users')
      .where('companyId', '==', companyId)
      .get();

    const batch = db.batch();
    usersSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'inactive',
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`Deleted company: ${companyId}`);
  });

// ============================================================================
// LOG AUDIT EVENTS
// ============================================================================

/**
 * Trigger: Log all document changes for audit trail
 */
export const onDocumentChange = functions.firestore
  .document('{collection}/{docId}')
  .onWrite(async (change, context) => {
    const { collection, docId } = context.params;
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    // Skip audit log documents
    if (collection === 'auditLogs') return;

    // Create audit log
    const auditEntry = {
      collection,
      documentId: docId,
      action: change.before.exists && change.after.exists ? 'update' : change.before.exists ? 'delete' : 'create',
      oldData: beforeData,
      newData: afterData,
      companyId: afterData?.companyId || beforeData?.companyId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      const companyId = auditEntry.companyId;
      if (companyId) {
        await db
          .collection('companies')
          .doc(companyId)
          .collection('auditLogs')
          .add(auditEntry);
      }
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  });
