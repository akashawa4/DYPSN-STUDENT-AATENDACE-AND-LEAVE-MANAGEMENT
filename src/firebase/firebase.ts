
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCViBhXXHRGvqVmtZiW5KwxNLsMNKIObp0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dyp-cse-attendace-management.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dyp-cse-attendace-management",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dyp-cse-attendace-management.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "280758426439",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:280758426439:web:b4811c1f2e96ee8c9e0a62",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-11Q12HBJ5K"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
export const db = getFirestore(app);