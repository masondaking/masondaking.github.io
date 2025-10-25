import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { isEmailBlacklisted, isPasswordBlacklisted } from "../../utils/blacklist";

export function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.displayName.trim()) {
      setError("Please enter a display name");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Enter a valid email address");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (isEmailBlacklisted(form.email)) {
      setError("This email is banned");
      return;
    }
    if (isPasswordBlacklisted(form.password)) {
      setError("This password is not allowed");
      return;
    }

    try {
      setSubmitting(true);
      await signup(form);
      navigate("/studio", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <h1>Create your account</h1>
        <p>Build a free profile to personalize prompts, save drafts, and sync your API keys.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Display name</span>
            <input
              type="text"
              value={form.displayName}
              onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              placeholder="Aria the Author"
              required
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Create a password"
              required
              minLength={8}
            />
            <small>Use at least 8 characters with a mix of letters and numbers.</small>
          </label>
          {error && <div className="auth-form__error">{error}</div>}
          <button type="submit" className="primary-button auth-form__submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <footer>
          Already have an account? <Link to="/login">Log in</Link>
        </footer>
      </motion.section>
    </div>
  );
}
