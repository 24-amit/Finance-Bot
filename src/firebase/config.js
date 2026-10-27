import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD_GcwiapdyWOnD_QgdeCZx-XcPqtiGxw8",
  authDomain: "finance-bot-94355.firebaseapp.com",
  projectId: "finance-bot-94355",
  storageBucket: "finance-bot-94355.firebasestorage.app",
  messagingSenderId: "862102968882",
  appId: "1:862102968882:web:9f825490e77cb0fea87a2b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);