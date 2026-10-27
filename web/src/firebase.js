import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDT5kfy5P4LsDhQFIW7ZCBolq7edCVhAow",
  authDomain: "flare-corporation.firebaseapp.com",
  databaseURL: "https://flare-corporation-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "flare-corporation",
  storageBucket: "flare-corporation.firebasestorage.app",
  messagingSenderId: "260809340266",
  appId: "1:260809340266:web:a39686b0dd288e2e2ca113",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function logout() {
  return signOut(auth);
}