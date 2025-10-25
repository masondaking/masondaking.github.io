import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";

interface LocationState {
  from?: { pathname: string };
}

interface BanMetaState {
  reason: string | null;
  bannedAt: string | null;
  lastAppealAt: string | null;
  nextAppealAt: string | null;
  canAppeal: boolean;
}

interface AppealFeedback {
  type: "success" | "error";
  text: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, submitBanAppeal } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [banMeta, setBanMeta] = useState<BanMetaState | null>(null);
  const [appealMessage, setAppealMessage] = useState("");
  const [appealFeedback, setAppealFeedback] = useState<AppealFeedback | null>(null);
  const [isAppealing, setAppealing] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBanMeta(null);
    setAppealMessage("");
    setAppealFeedback(null);

    try {
      setSubmitting(true);
      await login(form);
      const state = location.state as LocationState | undefined;
      navigate(state?.from?.pathname ?? "/studio", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in";
      if (err instanceof Error && (err as Error & { code?: string }).code === "BANNED") {
        const meta = (err as Error & { ban?: Record<string, unknown> }).ban ?? {};
        setBanMeta({
          reason: (meta?.reason ?? null) as string | null,
          bannedAt: (meta?.bannedAt ?? null) as string | null,
          lastAppealAt: (meta?.lastAppealAt ?? null) as string | null,
          nextAppealAt: (meta?.nextAppealAt ?? null) as string | null,
          canAppeal: Boolean(meta?.canAppeal),
        });
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppealSubmit = async () => {
    if (!banMeta?.canAppeal) return;
    if (!appealMessage.trim()) {
      setAppealFeedback({
        type: "error",
        text: "Please include details so the dev team can review your appeal.",
      });
      return;
    }
    try {
      setAppealing(true);
      setAppealFeedback(null);
      const result = submitBanAppeal({ email: form.email, message: appealMessage });
      setAppealFeedback({
        type: "success",
        text: "Appeal submitted. A developer will review it soon.",
      });
      setAppealMessage("");
      setBanMeta((prev) =>
        prev
          ? {
              ...prev,
              canAppeal: false,
              lastAppealAt: new Date().toISOString(),
              nextAppealAt: result.nextAllowedAt,
            }
          : prev
      );
    } catch (err) {
      if (err instanceof Error) {
        const code = (err as Error & { code?: string; nextAllowedAt?: string }).code;
        if (code === "APPEAL_COOLDOWN") {
          const nextAllowedAt = (err as Error & { nextAllowedAt?: string }).nextAllowedAt ?? null;
          setBanMeta((prev) =>
            prev
              ? { ...prev, canAppeal: false, nextAppealAt: nextAllowedAt ?? prev.nextAppealAt }
              : {
                  reason: null,
                  bannedAt: null,
                  lastAppealAt: null,
                  nextAppealAt: nextAllowedAt,
                  canAppeal: false,
                }
          );
        }
        setAppealFeedback({ type: "error", text: err.message });
      } else {
        setAppealFeedback({ type: "error", text: "Unable to submit appeal right now" });
      }
    } finally {
      setAppealing(false);
    }
  };

  const formatTimestamp = (value: string | null) => {
    if (!value) return null;
    try {
      return new Date(value).toLocaleString();
    } catch {
      return null;
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
        <h1>Welcome back</h1>
        <p>Continue the stories you started, or spin up a fresh narrative.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
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
              placeholder="Your password"
              required
            />
          </label>
          {error && <div className="auth-form__error">{error}</div>}
          <button type="submit" className="primary-button auth-form__submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Log in"}
          </button>
        </form>
        {banMeta && (
          <div className="auth-appeal">
            <h2>Request a review</h2>
            <p>
              Your account is currently banned
              {banMeta.reason ? ` for "${banMeta.reason}"` : ""}.
              {banMeta.bannedAt && (
                <>
                  {" "}
                  This action was recorded on <strong>{formatTimestamp(banMeta.bannedAt)}</strong>.
                </>
              )}
            </p>
            {banMeta.canAppeal ? (
              <>
                <p className="notice--muted">
                  You may submit one appeal every six months. Share context so a developer knows what changed.
                </p>
                <label className="auth-appeal__input">
                  <span>Appeal message</span>
                  <textarea
                    rows={3}
                    value={appealMessage}
                    onChange={(event) => setAppealMessage(event.target.value)}
                    placeholder="Explain what happened and why the ban should be reconsidered."
                  />
                </label>
                <div className="auth-appeal__actions">
                  <button type="button" className="ghost-button" onClick={handleAppealSubmit} disabled={isAppealing}>
                    {isAppealing ? "Submitting..." : "Submit appeal"}
                  </button>
                </div>
              </>
            ) : (
              <p className="notice--muted">
                You recently submitted an appeal. You can try again after {" "}
                <strong>{formatTimestamp(banMeta.nextAppealAt)}</strong>.
              </p>
            )}
            {appealFeedback && (
              <div className={`notice notice--${appealFeedback.type === "error" ? "error" : "success"}`}>
                {appealFeedback.text}
              </div>
            )}
          </div>
        )}
        <footer>
          New to Dreamscribe? <Link to="/signup">Create an account</Link>
        </footer>
      </motion.section>
    </div>
  );
}
