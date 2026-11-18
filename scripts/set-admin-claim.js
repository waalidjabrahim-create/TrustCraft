// Run locally with a service-account file kept OUTSIDE this repository.
// Usage: GOOGLE_APPLICATION_CREDENTIALS=/secure/path/admin-service-account.json node scripts/set-admin-claim.js USER_UID
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const uid = process.argv[2];
if (!uid) throw new Error('Usage: node scripts/set-admin-claim.js USER_UID');
initializeApp({ credential: applicationDefault() });
getAuth().setCustomUserClaims(uid, { admin: true }).then(() => {
  console.log(`Admin claim assigned to ${uid}. Ask the user to sign out and sign in again.`);
}).catch((err) => { console.error(err); process.exit(1); });
