import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
   apiKey: "AIzaSyBYN8n9azEFXlIjoN1XXW6SYu1Jn9a78yA",
  authDomain: "collabcode-b0926.firebaseapp.com",
  projectId: "collabcode-b0926",
  storageBucket: "collabcode-b0926.firebasestorage.app",
  messagingSenderId: "10643546394",
  appId: "1:10643546394:web:09d301d54b5e97a0014ca3",
  measurementId: "G-BGX2Y77NXT"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();