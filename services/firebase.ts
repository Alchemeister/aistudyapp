
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  enableIndexedDbPersistence,
  doc,
  setDoc,
  getDoc,
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import {
  getStorage,
  FirebaseStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  getBlob,
  deleteObject
} from 'firebase/storage';

// Helper to sanitize env vars
const clean = (val: string | undefined) => val ? val.replace(/["']/g, "").trim() : undefined;

// Safe environment access
const getEnv = (key: string): string | undefined => {
  try {
    // Check import.meta.env (Vite standard)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Ignore error
  }
  return undefined;
};

// Use defensive getter
const firebaseConfig = {
  apiKey: clean(getEnv('VITE_FIREBASE_API_KEY')),
  authDomain: clean(getEnv('VITE_FIREBASE_AUTH_DOMAIN')),
  projectId: clean(getEnv('VITE_FIREBASE_PROJECT_ID')),
  storageBucket: clean(getEnv('VITE_FIREBASE_STORAGE_BUCKET')),
  messagingSenderId: clean(getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID')),
  appId: clean(getEnv('VITE_FIREBASE_APP_ID')),
  measurementId: clean(getEnv('VITE_FIREBASE_MEASUREMENT_ID'))
};

// --- Debugging for User ---
console.log("--- Firebase Config Check ---");
const configKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

let missingCount = 0;
configKeys.forEach(key => {
    const val = getEnv(key);
    const isSet = !!(val && val.trim().length > 0);
    if (!isSet) missingCount++;
});

if (missingCount > 0) {
    console.info(`ℹ️ Firebase Config: ${missingCount} keys missing. This is normal in Preview/Dev if not using .env file. Auth will fail gracefully.`);
} else {
    console.log("✅ Firebase Config Loaded");
}
// ---------------------------

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let googleProvider: GoogleAuthProvider | undefined;
let isConfigured = false;

// Basic validation to ensure at least API Key is present
if (firebaseConfig.apiKey && firebaseConfig.authDomain) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
    isConfigured = true;

    // Enable offline persistence (data available without internet)
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not available in this browser');
      }
    });

    console.log("✅ Firestore initialized with offline persistence");
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
} else {
  console.log("Firebase running in offline/demo mode (Missing Config)");
}

export { auth, db, storage, isConfigured };

export const signInWithGoogle = async () => {
  if (!isConfigured || !auth || !googleProvider) {
    console.error("SignInWithGoogle failed: Configuration missing.");
    throw new Error("MISSING_CONFIG");
  }
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign In Error Object:", error);
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  if (!isConfigured || !auth) throw new Error("MISSING_CONFIG");
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const signUpWithEmail = async (email: string, password: string) => {
  if (!isConfigured || !auth) throw new Error("MISSING_CONFIG");
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const signOut = async () => {
  if (auth) {
    await firebaseSignOut(auth);
  }
};

// Re-export Firestore utilities for use in other services
export { doc, setDoc, getDoc, collection, collectionGroup, query, where, getDocs, deleteDoc, writeBatch };

// Re-export Storage utilities
export { ref, uploadBytes, getDownloadURL, getBlob, deleteObject };
