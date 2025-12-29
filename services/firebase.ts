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

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let googleProvider: GoogleAuthProvider | undefined;
let isConfigured = false;

// Basic validation to ensure at least API Key is present
if (firebaseConfig.apiKey && firebaseConfig.authDomain) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    isConfigured = true;
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
} else {
  console.warn("Firebase configuration missing. Check .env file.");
}

export { auth };

export const signInWithGoogle = async () => {
  if (!isConfigured || !auth || !googleProvider) {
    throw new Error("MISSING_CONFIG");
  }
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign In Error", error);
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