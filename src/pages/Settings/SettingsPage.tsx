import { FormEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useLibrary } from "../../context/LibraryContext";
import { useTheme } from "../../context/ThemeContext";
import { useRoles } from "../../context/RolesContext";
import { RoleBadge } from "../../components/ui/RoleBadge";
import { DevBadge } from "../../components/ui/DevBadge";

interface MessageState {
  type: "success" | "error";
  text: string;
}

export function SettingsPage() {
  const { user, logout, updateProfile, updatePassword } = useAuth();
  const { publishStory } = useLibrary();
  const { theme, setTheme, options: themeOptions } = useTheme();
  const { getRole, getUserRoleId } = useRoles();

  const [profileState, setProfileState] = useState(() => ({
    displayName: user?.displayName ?? "",
    bio: user?.bio ?? "",
    accentColor: user?.accentColor ?? "#7c3aed",
    avatarEmoji: user?.avatarEmoji ?? "✨",
  }));
  const [accountState, setAccountState] = useState(() => ({
    email: user?.email ?? "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  }));

  const [profileStatus, setProfileStatus] = useState<MessageState | null>(null);
  const [accountStatus, setAccountStatus] = useState<MessageState | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  if (!user) return null;

  const role = useMemo(() => {
    const id = getUserRoleId(user.username, user.isDev);
    return getRole(id);
  }, [getRole, getUserRoleId, user.isDev, user.username]);

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setProfileStatus(null);
    try {
      setSavingProfile(true);
      await Promise.resolve(
        updateProfile({
          displayName: profileState.displayName,
          bio: profileState.bio,
          accentColor: profileState.accentColor,
          avatarEmoji: profileState.avatarEmoji,
        })
      );
      setProfileStatus({ type: "success", text: "Profile updated" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile";
      setProfileStatus({ type: "error", text: message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEmailUpdate = async () => {
    setAccountStatus(null);
    try {
      setSavingAccount(true);
      await Promise.resolve(updateProfile({ email: accountState.email }));
      setAccountStatus({ type: "success", text: "Email updated" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update email";
      setAccountStatus({ type: "error", text: message });
    } finally {
      setSavingAccount(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setAccountStatus(null);
    if (accountState.newPassword !== accountState.confirmPassword) {
      setAccountStatus({ type: "error", text: "Passwords do not match" });
      return;
    }
    try {
      setSavingAccount(true);
      await updatePassword({
        currentPassword: accountState.currentPassword,
        newPassword: accountState.newPassword,
      });
      setAccountState((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setAccountStatus({ type: "success", text: "Password updated" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update password";
      setAccountStatus({ type: "error", text: message });
    } finally {
      setSavingAccount(false);
    }
  };

  const handleResetDemoData = () => {
    const keys = [
      "sf:workspace",
      "sf:published-stories",
      "sf:provider-keys",
      "sf:provider-selected",
      "sf:provider-custom",
      "sf:provider-models",
    ];
    keys.forEach((k) => localStorage.removeItem(k));
    alert("Cleared local demo data. Reloading page…");
    window.location.reload();
  };

  const handleSeedStories = () => {
    const samples = [
      {
        metadata: {
          title: "The Clockwork Garden",
          genre: "Solarpunk mystery",
          tone: "Warm, hopeful, poetic",
          perspective: "First person",
          targetLength: "short" as const,
        },
        summary:
          "In a city of living machines, a gardener follows a trail of missing pollinators into the heart of an ancient secret.",
        tags: ["#solarpunk", "#mystery", "#hopepunk"],
        content:
          "Dawn warmed the copper leaves until they hummed. I pressed my palm to the trunk and felt the old tree wake...",
      },
      {
        metadata: {
          title: "Error: Tenderness Not Found",
          genre: "Near-future sci-fi",
          tone: "Reflective, wry",
          perspective: "Close third person",
          targetLength: "medium" as const,
        },
        summary:
          "A maintenance engineer patches bugs in the city's empathy network and discovers a glitch that feels like love.",
        tags: ["#scifi", "#romance", "#nearfuture"],
        content:
          "The alert chimed at 03:12: node E-19 had gone cold. Miri rolled out of bed, grabbed her toolkit, and told herself not to name the fault this time...",
      },
    ];

    samples.forEach((sample) => {
      publishStory({
        authorId: user.id,
        authorName: user.displayName,
        metadata: sample.metadata,
        content: sample.content,
        summary: sample.summary,
        tags: sample.tags,
      });
    });

    alert("Seeded a couple of sample stories into your library.");
  };

  return (
    <div className="section-shell">
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Profile</h2>
            <p style={{ margin: "6px 0 0", color: "var(--color-text-muted)" }}>
              Update how your name and avatar appear across Dreamscribe.
            </p>
          </div>
          {user.isDev && <DevBadge size="md" />}
        </header>

        <form onSubmit={handleProfileSubmit} style={{ display: "grid", gap: 16, marginTop: 18 }}>
          <label>
            <span style={{ display: "block", fontWeight: 600 }}>Display name</span>
            <input
              value={profileState.displayName}
              onChange={(event) => setProfileState((prev) => ({ ...prev, displayName: event.target.value }))}
              required
            />
          </label>
          <label>
            <span style={{ display: "block", fontWeight: 600 }}>Profile bio</span>
            <textarea
              value={profileState.bio}
              onChange={(event) => setProfileState((prev) => ({ ...prev, bio: event.target.value }))}
              rows={3}
              placeholder="Share a short introduction or creative focus."
              style={{ resize: "vertical" }}
            />
          </label>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 160px" }}>
              <span style={{ display: "block", fontWeight: 600 }}>Avatar emoji</span>
              <input
                value={profileState.avatarEmoji}
                onChange={(event) =>
                  setProfileState((prev) => ({ ...prev, avatarEmoji: event.target.value.slice(0, 4) }))
                }
                maxLength={4}
                style={{ fontSize: "1.6rem", textAlign: "center" }}
              />
            </label>
            <label style={{ flex: "1 1 160px" }}>
              <span style={{ display: "block", fontWeight: 600 }}>Accent colour</span>
              <input
                type="color"
                value={profileState.accentColor}
                onChange={(event) => setProfileState((prev) => ({ ...prev, accentColor: event.target.value }))}
                style={{ width: "100%", height: 44, padding: 0 }}
              />
            </label>
          </div>
          <div className="profile-preview-card" style={{ borderColor: profileState.accentColor }}>
            <div className="profile-preview-card__avatar" style={{ backgroundColor: profileState.accentColor }}>
              <span>{profileState.avatarEmoji || "✨"}</span>
            </div>
            <div>
              <strong>{profileState.displayName}</strong>
              <p>{profileState.bio ? profileState.bio : "Add a bio so readers know what you create."}</p>
            </div>
          </div>

          {profileStatus && (
            <div className={`notice notice--${profileStatus.type === "error" ? "error" : "success"}`}>
              {profileStatus.text}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="submit" className="primary-button" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
            <button type="button" className="ghost-button" onClick={logout}>
              Log out
            </button>
          </div>
        </form>
      </motion.section>

      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.04 }}
        style={{ marginTop: 18 }}
      >
        <h3 style={{ marginTop: 0 }}>Account security</h3>
        <p className="notice--muted">Manage your sign-in email and password.</p>

        <div style={{ display: "grid", gap: 18, marginTop: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              <span style={{ display: "block", fontWeight: 600 }}>Email</span>
              <input
                type="email"
                value={accountState.email}
                onChange={(event) => setAccountState((prev) => ({ ...prev, email: event.target.value }))}
                required
              />
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={handleEmailUpdate}
              disabled={savingAccount}
            >
              Update email
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label>
              <span style={{ display: "block", fontWeight: 600 }}>Current password</span>
              <input
                type="password"
                value={accountState.currentPassword}
                onChange={(event) =>
                  setAccountState((prev) => ({ ...prev, currentPassword: event.target.value }))
                }
              />
            </label>
            <label>
              <span style={{ display: "block", fontWeight: 600 }}>New password</span>
              <input
                type="password"
                value={accountState.newPassword}
                onChange={(event) =>
                  setAccountState((prev) => ({ ...prev, newPassword: event.target.value }))
                }
              />
            </label>
            <label>
              <span style={{ display: "block", fontWeight: 600 }}>Confirm password</span>
              <input
                type="password"
                value={accountState.confirmPassword}
                onChange={(event) =>
                  setAccountState((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className="ghost-button"
              onClick={handlePasswordUpdate}
              disabled={savingAccount}
            >
              Update password
            </button>
          </div>

          {accountStatus && (
            <div className={`notice notice--${accountStatus.type === "error" ? "error" : "success"}`}>
              {accountStatus.text}
            </div>
          )}
        </div>
      </motion.section>

      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        style={{ marginTop: 18 }}
      >
        <h3 style={{ marginTop: 0 }}>Appearance</h3>
        <p className="notice--muted">Pick a theme that matches your workspace.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {themeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`theme-option ${theme === option.id ? "theme-option--active" : ""}`}
              onClick={() => setTheme(option.id)}
            >
              <span>
                <strong>{option.label}</strong>
                <span className="theme-option__description">{option.description}</span>
              </span>
              <span className="theme-option__status">{theme === option.id ? "Active" : "Switch"}</span>
            </button>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        style={{ marginTop: 18 }}
      >
        <h3 style={{ marginTop: 0 }}>Account snapshot</h3>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <strong>Member since:</strong> {new Date(user.createdAt).toLocaleString()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong>Role:</strong>
            <RoleBadge role={role} />
            {user.isDev && <DevBadge size="sm" />}
          </div>
          {user.warnings && user.warnings.length > 0 && (
            <div className="notice notice--warning">
              <strong>Caution:</strong> You have {user.warnings.length} active warning
              {user.warnings.length > 1 ? "s" : ""}.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <button type="button" className="ghost-button" onClick={handleResetDemoData}>
            Reset demo data
          </button>
          <button type="button" className="primary-button" onClick={handleSeedStories}>
            Seed sample stories
          </button>
        </div>
      </motion.section>
    </div>
  );
}
