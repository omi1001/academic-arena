import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
// @ts-ignore — getReactNativePersistence exists in the RN bundle
import { initializeAuth, getAuth, getReactNativePersistence, Auth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBl_lNoVoqiv58rf5NpOAR1UtFiv9-0ocQ',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'academic-arena-60b8b.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'academic-arena-60b8b',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'academic-arena-60b8b.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '573925870613',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:573925870613:web:1900e3a87e82ad534d921c',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
} catch (appErr) {
  console.warn('Firebase initializeApp error, falling back:', appErr);
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
}

try {
  if (getReactNativePersistence && AsyncStorage) {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    auth = getAuth(app);
  }
} catch (authErr: any) {
  try {
    auth = getAuth(app);
  } catch (fallbackErr) {
    console.warn('Firebase auth fallback initialization error:', fallbackErr);
    try {
      auth = initializeAuth(app, {
        persistence: inMemoryPersistence,
      });
    } catch (finalErr) {
      auth = getAuth(app);
    }
  }
}

try {
  db = getFirestore(app);
} catch (dbErr) {
  console.warn('Firebase Firestore initialization error:', dbErr);
  db = getFirestore(app);
}

export { app, auth, db };
