const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using env variables
// Download serviceAccountKey.json from Firebase Console > Project Settings > Service Accounts
// OR use the env vars below — both work.

const hasServiceAccount = process.env.FIREBASE_PROJECT_ID
  && process.env.FIREBASE_CLIENT_EMAIL
  && process.env.FIREBASE_PRIVATE_KEY;

if (hasServiceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  console.log('Firebase Admin initialized from env vars');
} else {
  // Fallback: try loading serviceAccountKey.json from project root
  try {
    const serviceAccount = require('../../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialized from serviceAccountKey.json');
  } catch (e) {
    console.warn('Firebase Admin not configured — set env vars or add serviceAccountKey.json');
  }
}

module.exports = admin;
