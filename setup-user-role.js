// Firebase Admin SDK script to assign custom claims to users
// Run this with Node.js to set up user roles

const admin = require('firebase-admin');

// Initialize Firebase Admin (you'll need your service account key)
// Download the service account key from Firebase Console > Project Settings > Service Accounts
const serviceAccount = require('./path-to-your-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setUserRole(email, role) {
  try {
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);
    
    // Set custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
      role: role,
      email_verified: true // Override email verification if needed
    });
    
    console.log(`✅ Successfully set role "${role}" for user ${email}`);
    console.log(`User UID: ${user.uid}`);
    
    // Verify the claims were set
    const userRecord = await admin.auth().getUser(user.uid);
    console.log('Custom claims:', userRecord.customClaims);
    
  } catch (error) {
    console.error('❌ Error setting user role:', error);
  }
}

// Set role for your user
setUserRole('productio@gmail.com', 'controller')
  .then(() => {
    console.log('✅ User role setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
