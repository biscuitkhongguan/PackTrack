import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "demo-key",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "demo-project.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "demo-project",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "demo-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "1:000:web:000",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/** True only when real Firebase credentials are provided via env vars */
export const isFirebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;
