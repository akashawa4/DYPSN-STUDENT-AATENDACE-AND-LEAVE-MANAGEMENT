// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBqzZiPX2z3gdwXoSFOEnn1Qjkdx8--y6Q",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cse-attendance-system-9c4e5.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cse-attendance-system-9c4e5",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "cse-attendance-system-9c4e5.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "788844291261",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:788844291261:web:e984629a1505859eb003d4",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://cse-attendance-system-9c4e5-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);
export const db = getFirestore(app);