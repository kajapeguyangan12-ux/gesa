// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
console.log("API KEY:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
// Your web app's Firebase configuration
// TODO: Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only in the browser/runtime where `window` exists.
// This prevents server-side imports from trying to initialize Firebase
// with missing client-side env vars and causing `auth/invalid-api-key`.
const isBrowser = typeof window !== "undefined";

let app: any = undefined;
let db: any = undefined;
let auth: any = undefined;
let storage: any = undefined;

if (isBrowser) {
  if (!firebaseConfig.apiKey) {
    // Missing API key — warn and avoid initializing; caller should provide env vars.
    // This prevents runtime Firebase errors during SSR or missing .env.local.
    // eslint-disable-next-line no-console
    console.warn(
      "Missing NEXT_PUBLIC_FIREBASE_API_KEY — Firebase not initialized. Add a .env.local with your Firebase config."
    );
  } else {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
  }
}

export { app, db, auth, storage };
