/**
 * Migration Script for Single-Tenant to Multi-Tenant Architecture
 * This script migrates existing data to the new multi-tenant structure
 */

import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  DocumentReference,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const admin = require('firebase-admin');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Initialize Firebase Admin SDK
const serviceAccount = require('./path-to-your-service-account-key.json');
const adminApp = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(adminApp);
const auth = getAuth(adminApp);

// The company ID to migrate all existing data to
// Update this before running migration
const MIGRATION_COMPANY_ID = 'default-company-uuid';

// Run with: npx ts-node migration-script.ts
async function runMigration() {
  console.log('🚀 Starting migration to multi-tenant architecture...\n');

  try {
    // Step 1: Create the default company
    console.log('📝 Step 1: Creating default company...');
    await createDefaultCompany();
    console.log('✅ Default company created\n');

    // Step 2: Migrate existing users
    console.log('📝 Step 2: Migrating users...');
    await migrateUsers();
    console.log('✅ Users migrated\n');

    // Step 3: Migrate invoices
    console.log('📝 Step 3: Migrating invoices...');
    await migrateCollection('invoices', MIGRATION_COMPANY_ID);
    console.log('✅ Invoices migrated\n');

    // Step 4: Migrate clients
    console.log('📝 Step 4: Migrating clients...');
    await migrateCollection('clients', MIGRATION_COMPANY_ID);
    console.log('✅ Clients migrated\n');

    // Step 5: Migrate reports
    console.log('📝 Step 5: Migrating reports...');
    await migrateCollection('productionReports', MIGRATION_COMPANY_ID);
    console.log('✅ Reports migrated\n');

    // Step 6: Migrate exports
    console.log('📝 Step 6: Migrating exports...');
    await migrateCollection('exports', MIGRATION_COMPANY_ID);
    console.log('✅ Exports migrated\n');

    // Step 7: Migrate packaging traces
    console.log('📝 Step 7: Migrating packaging traces...');
    await migrateCollection('packaging_traces', MIGRATION_COMPANY_ID);
    console.log('✅ Packaging traces migrated\n');

    // Step 8: Verify migration
    console.log('📝 Step 8: Verifying migration...');
    await verifyMigration();
    console.log('✅ Migration verified\n');

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Create the default company for all existing data
 */
async function createDefaultCompany() {
  // Find the first/oldest user to be the company owner
  const usersRef = collection(db, 'users');
  const usersSnapshot = await getDocs(usersRef);

  if (usersSnapshot.empty) {
    throw new Error('No users found to set as company owner');
  }

  const firstUser = usersSnapshot.docs[0].data();
  const ownerId = usersSnapshot.docs[0].id;

  const companyRef = doc(db, 'companies', MIGRATION_COMPANY_ID);
  await setDoc(companyRef, {
    id: MIGRATION_COMPANY_ID,
    name: 'Company Name',
    ownerId,
    createdAt: Timestamp.now(),
    subscriptionPlan: 'pro',
    status: 'active',
    metadata: {
      migratedAt: Timestamp.now(),
      legacyCompany: true,
    },
  });

  console.log(`  ✓ Created default company with ID: ${MIGRATION_COMPANY_ID}`);
}

/**
 * Migrate users collection with companyId field
 */
async function migrateUsers() {
  const usersRef = collection(db, 'users');
  const usersSnapshot = await getDocs(usersRef);

  if (usersSnapshot.empty) {
    console.log('  ℹ️  No users to migrate');
    return;
  }

  const batch = writeBatch(db);
  let count = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();

    // Only update if companyId doesn't exist
    if (!userData.companyId) {
      const userRef = doc(db, 'users', userDoc.id);

      const role = userData.isAdmin || userData.role === 'admin' ? 'admin' : 'employee';

      batch.update(userRef, {
        companyId: MIGRATION_COMPANY_ID,
        role,
        status: userData.status || 'active',
        updatedAt: Timestamp.now(),
      });

      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`  ✓ Updated ${count} users with companyId`);
  } else {
    console.log('  ℹ️  All users already have companyId');
  }

  // Update custom claims for all users
  console.log('  ⏳ Updating Firebase Auth custom claims...');
  let claimsUpdated = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const role = userData.role || 'employee';

    try {
      await auth.setCustomUserClaims(userDoc.id, {
        companyId: MIGRATION_COMPANY_ID,
        role,
        email: userData.email,
      });
      claimsUpdated++;
    } catch (error) {
      console.warn(`  ⚠️  Failed to set claims for user ${userDoc.id}`);
    }
  }

  console.log(`  ✓ Updated custom claims for ${claimsUpdated} users`);
}

/**
 * Migrate a collection by adding companyId to all documents
 */
async function migrateCollection(
  collectionName: string,
  companyId: string
) {
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);

  if (snapshot.empty) {
    console.log(`  ℹ️  No documents in ${collectionName}`);
    return;
  }

  const batch = writeBatch(db);
  let count = 0;

  for (const doc_ of snapshot.docs) {
    const data = doc_.data();

    // Only update if companyId doesn't exist
    if (!data.companyId) {
      batch.update(doc_.ref, {
        companyId,
        updatedAt: Timestamp.now(),
      });
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`  ✓ Updated ${count} documents in ${collectionName}`);
  } else {
    console.log(`  ℹ️  All documents in ${collectionName} already have companyId`);
  }
}

/**
 * Verify migration was successful
 */
async function verifyMigration() {
  const collections = [
    'users',
    'invoices',
    'clients',
    'productionReports',
    'exports',
    'packaging_traces',
  ];

  const report = {
    company: await verifyCompanyExists(),
    collections: {} as Record<string, { total: number; withCompanyId: number }>,
  };

  for (const collectionName of collections) {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);

    const docsWithoutCompanyId = snapshot.docs.filter(doc => !doc.data().companyId);

    report.collections[collectionName] = {
      total: snapshot.size,
      withCompanyId: snapshot.size - docsWithoutCompanyId.length,
    };

    if (docsWithoutCompanyId.length > 0) {
      console.log(`  ⚠️  ${docsWithoutCompanyId.length} documents in ${collectionName} are missing companyId`);
      docsWithoutCompanyId.forEach(doc => {
        console.log(`     - ${collectionName}/${doc.id}`);
      });
    } else {
      console.log(`  ✓ ${collectionName}: all ${snapshot.size} documents have companyId`);
    }
  }

  return report;
}

/**
 * Verify company exists
 */
async function verifyCompanyExists() {
  const companyRef = doc(db, 'companies', MIGRATION_COMPANY_ID);
  const snapshot = await getDocs(
    query(collection(db, 'companies'), where('id', '==', MIGRATION_COMPANY_ID))
  );

  if (snapshot.empty) {
    console.log('  ⚠️  Default company not found');
    return false;
  }

  console.log(`  ✓ Default company exists: ${MIGRATION_COMPANY_ID}`);
  return true;
}

// ============================================================================
// ROLLBACK FUNCTION (USE WITH CAUTION!)
// ============================================================================

/**
 * Rollback migration - remove companyId from all documents
 * WARNING: Only use if migration fails midway
 */
async function rollbackMigration() {
  console.log('🚨 Starting rollback...\n');

  try {
    const collections = [
      'users',
      'invoices',
      'clients',
      'productionReports',
      'exports',
      'packaging_traces',
    ];

    for (const collectionName of collections) {
      console.log(`  Rolling back ${collectionName}...`);
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);

      const batch = writeBatch(db);
      let count = 0;

      for (const doc_ of snapshot.docs) {
        const data = doc_.data();
        if (data.companyId) {
          // Remove companyId field
          batch.update(doc_.ref, {
            companyId: admin.firestore.FieldValue.delete(),
          });
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        console.log(`  ✓ Rolled back ${count} documents`);
      }
    }

    // Delete the company document
    const companyRef = doc(db, 'companies', MIGRATION_COMPANY_ID);
    await admin.firestore().doc(`companies/${MIGRATION_COMPANY_ID}`).delete();
    console.log(`  ✓ Deleted company: ${MIGRATION_COMPANY_ID}`);

    console.log('\n✅ Rollback completed');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

// Export for use in other scripts
export { runMigration, rollbackMigration };

// Run if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'rollback') {
    console.log('⚠️  WARNING: This will remove all companyId fields!');
    console.log('Continue? (type "yes" to confirm)');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('> ', async answer => {
      if (answer.toLowerCase() === 'yes') {
        await rollbackMigration();
      } else {
        console.log('Cancelled');
      }
      rl.close();
      process.exit(0);
    });
  } else {
    runMigration().then(() => process.exit(0));
  }
}
