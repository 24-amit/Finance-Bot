
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError("Please enter your full name.");
      return;
    }

    setLoading(true);

    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      await updateProfile(result.user, {
        displayName: cleanName,
      });

      await setDoc(doc(db, "users", result.user.uid), {
        uid: result.user.uid,
        name: cleanName,
        email: cleanEmail,
        currency: "INR",
        createdAt: serverTimestamp(),
      });

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Registration error:", err.code, err.message);

      if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists. Please log in.");
      } else if (err.code === "auth/weak-password") {
        setError("Your password is too weak. Please choose a stronger password.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "permission-denied" ||
                 err.code === "firestore/permission-denied") {
        setError(
          "Your account was created, but its profile could not be saved. Please check Firestore security rules and try logging in again."
        );
      } else if (err.code?.startsWith("auth/")) {
        setError("Registration failed. Please try again.");
      } else {
        setError(
          "Your profile could not be saved. Check your internet connection and Firestore configuration."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleRegister}>
        <h1>Create Account</h1>
        <p>Start managing your money smarter.</p>

        <label>Full Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          autoComplete="name"
          placeholder="Enter your full name"
        />

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="Enter your email"
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="At least 6 characters"
        />

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>

        <p>
          Already registered? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}