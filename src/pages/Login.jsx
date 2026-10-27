
import { useState } from "react";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { Link, useNavigate } from "react-router-dom";

function getLoginError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "The email address format is invalid. Please check it.";

    case "auth/user-not-found":
      return "No account was found for this email. Check the address or register again.";

    case "auth/wrong-password":
      return "The password is incorrect. Please try again.";

    case "auth/user-disabled":
      return "Your account has been disabled by the administrator. Please contact the administrator for assistance.";

    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "The email or password is incorrect. Please check your details and try again.";

    case "auth/too-many-requests":
      return "Too many failed login attempts. Please wait before trying again.";

    case "auth/network-request-failed":
      return "Unable to connect. Check your internet connection and try again.";

    default:
      return "Login could not be completed. Please try again.";
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnapshot = await getDoc(userRef);

      // Repair a missing profile for an existing Auth account.
      if (!userSnapshot.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName || "",
          email: user.email || email.trim(),
          currency: "INR",
          createdAt: serverTimestamp(),
        });
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Login error:", err.code, err.message);

      if (err.code?.startsWith("auth/")) {
        setError(getLoginError(err.code));
      } else {
        setError(
          "You signed in, but your profile could not be loaded or created. Check Firestore rules and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleLogin}>
        <h1>Welcome Back</h1>
        <p>Sign in to manage your finances securely.</p>

        <label>Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="Enter your registered email"
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="Enter your password"
        />

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>

        <p>
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </form>
    </div>
  );
}