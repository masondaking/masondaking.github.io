import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import type { BanAppeal } from "../../context/AuthContext";
import { useDebug } from "../../context/DebugContext";
import { useProviderRegistry } from "../../context/ProviderContext";
import { useLibrary } from "../../context/LibraryContext";
import { useModeration } from "../../context/ModerationContext";
import { useRoles } from "../../context/RolesContext";
import { addBlacklistedEmail, addBlacklistedPwdHash, removeBlacklistedEmail, removeBlacklistedPwdHash } from "../../utils/blacklist";
import { useAnnouncements } from "../../context/AnnouncementsContext";

export function DevToolsPage() {
  const { user, getUsers, banUser, unbanUser, getBanAppeals, resolveBanAppeal } = useAuth();
  const { append: log, toggleConsole } = useDebug();
  const { providers, selectedProvider, selectedModel, selectProvider, setApiKey, apiKeys } = useProviderRegistry();
  const { stories, deleteReview, deleteStory } = useLibrary();
  const { blockedWords, addBlockedWord, removeBlockedWord, logs, validateText, recordLog } = useModeration();
  const { roles, createRole, updateRole, deleteRole, getRole, getUserRoleId, assignRole } = useRoles();
  const { announcement, publishAnnouncement, clearAnnouncement, dismissedBy, heartedBy } = useAnnouncements();

  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastAllowHearts, setBroadcastAllowHearts] = useState(true);
  const [broadcastFeedback, setBroadcastFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [appeals, setAppeals] = useState<BanAppeal[]>(() => getBanAppeals());

  useEffect(() => {
    setAppeals(getBanAppeals());
  }, []);

  useEffect(() => {
    if (announcement) {
      setBroadcastText(announcement.message);
      setBroadcastAllowHearts(announcement.allowHearts);
    } else {
      setBroadcastText("");
      setBroadcastAllowHearts(true);
    }
  }, [announcement]);

  const heartCount = useMemo(() => Object.keys(heartedBy).length, [heartedBy]);
  const dismissedCount = useMemo(() => Object.keys(dismissedBy).length, [dismissedBy]);
  const refreshAppeals = () => setAppeals(getBanAppeals());

  if (!user || (!user.isDev && !user.isAdmin)) {
    return (
      <div className="section-shell">
        <div className="glass-card">
          <h2 style={{ margin: 0 }}>Restricted</h2>
          <p>This area is for developer accounts only.</p>
        </div>
      </div>
    );
  }

  const isDeveloper = user.isDev;
  const isAdminOnly = user.isAdmin && !user.isDev;
  const canManageRoles = isDeveloper;
  const canAssignRoles = isDeveloper;

  const handleMockRequest = () => {
    log({ level: "request", summary: `Mock request to ${selectedProvider.id}`, payload: { model: selectedModel, ts: Date.now() } });
    setTimeout(() => log({ level: "response", summary: "Mock response", payload: { tokens: 1234, ok: true } }), 400);
  };

  const handleSetSampleKey = () => {
    const sample = `sk-${selectedProvider.id}-sample-key`; // placeholder
    setApiKey(selectedProvider.id, sample);
  };

  const handleBroadcastSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = broadcastText.trim();
    if (!trimmed) {
      setBroadcastFeedback({ type: "error", text: "Enter a message before publishing." });
      return;
    }
    publishAnnouncement({ message: trimmed, allowHearts: broadcastAllowHearts });
    setBroadcastText(trimmed);
    setBroadcastFeedback({ type: "success", text: "Announcement saved. Users will see it on their next sign-in." });
  };

  const handleClearBroadcast = () => {
    clearAnnouncement();
    setBroadcastFeedback({ type: "success", text: "Announcement cleared." });
  };

  const handleResolveAppeal = (appealId: string, action: "approve" | "reject") => {
    if (action === "approve") {
      const ok = window.confirm("Approve this appeal and unban the account?");
      if (!ok) return;
    }
    let note: string | undefined = undefined;
    if (action === "reject") {
      const input = window.prompt("Optional: Add a note for this decision");
      note = input?.trim() ? input.trim() : undefined;
    }
    resolveBanAppeal(appealId, action, note);
    refreshAppeals();
  };

  return (
    <div className="section-shell">
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 style={{ marginTop: 0 }}>Developer Tools</h2>
        <p className="notice--muted">Quick actions for verifying integrations, moderation, and UI flows.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <div>
            <strong>Provider:</strong>{" "}
            <select value={selectedProvider.id} onChange={(e) => selectProvider(e.target.value as any)}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <strong>API key:</strong>{" "}
            <code style={{ opacity: 0.8 }}>{apiKeys[selectedProvider.id] ? "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : "<empty>"}</code>{" "}
            <button type="button" className="ghost-button" onClick={handleSetSampleKey}>Set sample key</button>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="primary-button" onClick={handleMockRequest}>Emit mock request</button>
            <button type="button" className="ghost-button" onClick={toggleConsole}>Toggle Debug Console</button>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.03 }}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>Message all users</h3>
        <p className="section-subtitle">Publish a global announcement that appears after sign-in.</p>
        <form onSubmit={handleBroadcastSubmit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <textarea
            value={broadcastText}
            onChange={(event) => setBroadcastText(event.target.value)}
            placeholder="Share release notes, scheduled downtime, or community news."
            rows={3}
            style={{
              padding: "0.8rem 0.95rem",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(18, 16, 40, 0.82)",
              color: "inherit",
              resize: "vertical",
            }}
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={broadcastAllowHearts}
              onChange={(event) => setBroadcastAllowHearts(event.target.checked)}
            />
            Allow â™¥ reactions
          </label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="submit" className="primary-button">
              {announcement ? "Update message" : "Publish message"}
            </button>
            {announcement && (
              <button type="button" className="ghost-button" onClick={handleClearBroadcast}>
                Clear message
              </button>
            )}
          </div>
        </form>
        {announcement && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, fontSize: 13, opacity: 0.85 }}>
            <span>Active since {new Date(announcement.createdAt).toLocaleString()}</span>
            <span>Hearts: {heartCount}</span>
            <span>Dismissed: {dismissedCount}</span>
            <span>{announcement.allowHearts ? "Heart reactions enabled" : "Heart reactions disabled"}</span>
          </div>
        )}
        {broadcastFeedback && (
          <div
            className={`notice notice--${broadcastFeedback.type === "error" ? "error" : "success"}`}
            style={{ marginTop: 12 }}
          >
            {broadcastFeedback.text}
          </div>
        )}
      </motion.section>

      {/* User management */}
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>User management</h3>
        <p className="section-subtitle">Ban/unban local users in this browser.</p>
        <div style={{ display: "grid", gap: 8 }}>
          {getUsers().map((u) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div>
                <strong>{u.displayName}</strong> <span style={{ opacity: 0.7 }}>({u.email})</span> {u.isDev && <span className="dev-badge dev-badge--sm" style={{ marginLeft: 8 }}>DEV</span>}
                {u.banned && u.banReason && (
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Reason: {u.banReason}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Role assignment */}
                <span style={{ fontSize: 12, opacity: 0.8 }}>Role</span>
                <select
                  value={getUserRoleId(u.username, { isDev: u.isDev, isAdmin: u.isAdmin })}
                  onChange={(e) => assignRole(u.username, e.target.value)}
                  disabled={!canAssignRoles}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                {u.isDev ? (
                  <span className="notice--muted">Protected</span>
                ) : u.banned ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      unbanUser(u.username);
                      recordLog({ type: "unban", targetUserId: u.id, targetUsername: u.username });
                      try {
                        const raw = localStorage.getItem('dreamscribe_users');
                        if (raw) {
                          const data = JSON.parse(raw) as Record<string, { email: string; password: string }>; 
                          const rec = data[u.username];
                          if (rec) {
                            removeBlacklistedEmail(rec.email);
                            if (rec.password) removeBlacklistedPwdHash(rec.password);
                          }
                        }
                      } catch {}
                    }}
                  >
                    Unban
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      if (isDeveloper && u.isAdmin && !u.isDev) {
                        const ok = window.confirm("Warning: you are about to ban the admin account. Continue?");
                        if (!ok) return;
                      }
                      const reason = prompt("Enter ban reason (required)")?.trim();
                      if (!reason) return;
                      try {
                        const raw = localStorage.getItem('dreamscribe_users');
                        if (raw) {
                          const data = JSON.parse(raw) as Record<string, { email: string; password: string }>; 
                          const rec = data[u.username];
                          if (rec) {
                            addBlacklistedEmail(rec.email);
                            if (rec.password) addBlacklistedPwdHash(rec.password);
                          }
                        }
                      } catch {}
                      banUser(u.username, reason);
                      recordLog({ type: "ban", targetUserId: u.id, targetUsername: u.username, details: reason });
                    }}
                  >
                    Ban
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Role definitions */}
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06 }}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>Roles</h3>
        {!canManageRoles && (
          <p className="notice--muted" style={{ marginBottom: 12 }}>
            Only developers can create or edit role definitions.
          </p>
        )}
        {canManageRoles && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget as HTMLFormElement;
            const label = (f.elements.namedItem('label') as HTMLInputElement).value.trim();
            const name = (f.elements.namedItem('name') as HTMLInputElement).value.trim() || label.toLowerCase().replace(/\s+/g, '-');
            const color = (f.elements.namedItem('color') as HTMLInputElement).value.trim() || '#444';
            const textColor = (f.elements.namedItem('textColor') as HTMLInputElement).value.trim() || '#fff';
            const emoji = (f.elements.namedItem('emoji') as HTMLInputElement).value.trim();
            if (!label) return;
            createRole({ name, label, color, textColor, emoji });
            f.reset();
          }}
          style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
        >
          <input name="label" placeholder="Label (e.g., VIP)" />
          <input name="name" placeholder="Key (optional)" />
          <input name="emoji" placeholder="Emoji (optional)" />
          <input name="color" placeholder="#f59e0b" />
          <input name="textColor" placeholder="#1a1306" />
          <button className="primary-button" type="submit">Create role</button>
        </form>
        )}
        <div className="card-grid" style={{ marginTop: 10 }}>
          {roles.map((r) => (
            <div key={r.id} className="glass-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong>{r.label}</strong>
                <span style={{ background: r.color, color: r.textColor, borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>
                  {r.emoji ? r.emoji + ' ' : ''}{r.name}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {canManageRoles && (
                  <button type="button" className="ghost-button" onClick={() => updateRole(r.id, { label: prompt('New label', r.label) || r.label })}>Rename</button>
                )}
                {canManageRoles && r.id !== 'paid' && r.id !== 'free' && r.id !== 'admin' && (
                  <button type="button" className="ghost-button" onClick={() => deleteRole(r.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Stories admin */}
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>Stories</h3>
        {stories.length === 0 ? (
          <p className="notice--muted">No stories published yet.</p>
        ) : (
          <div className="card-grid">
            {stories.slice(0, 12).map((s) => (
              <div key={s.id} className="glass-card" style={{ padding: 12 }}>
                <strong>{s.metadata.title}</strong>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  by {s.authorName} â€¢ {new Date(s.publishedAt).toLocaleString()}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      if (!confirm('Delete this story?')) return;
                      deleteStory(s.id);
                      recordLog({ type: 'note', details: `deleted story ${s.id}` });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Review moderation */}
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>Reviews</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {stories.flatMap((s) => s.reviews.map((r) => ({ s, r }))).length === 0 ? (
            <p className="notice--muted">No reviews yet.</p>
          ) : (
            stories.flatMap((s) => s.reviews.map((r) => ({ s, r }))).map(({ s, r }) => (
              <div key={r.id} style={{ display: "grid", gap: 6, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{r.reviewerName}</strong>
                  <span>on <em>{s.metadata.title}</em></span>
                </div>
                <div style={{ fontSize: 14, opacity: 0.86 }}>
                  {r.comment}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      deleteReview(r.id);
                      recordLog({ type: "delete_review", targetResourceId: r.id, details: `from story: ${s.id}` });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.section>

      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.07 }}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>Ban appeals</h3>
        <p className="section-subtitle">Review user appeals. Approving will unban and clear restrictions.</p>
        {appeals.length === 0 ? (
          <p className="notice--muted">No appeals have been submitted yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {appeals.map((appeal) => (
              <div key={appeal.id} className="appeal-card">
                <div className="appeal-card__header">
                  <div>
                    <strong>{appeal.username}</strong>{" "}
                    <span style={{ opacity: 0.75 }}>({appeal.email})</span>
                  </div>
                  <span className={`appeal-card__status appeal-card__status--${appeal.status}`}>
                    {appeal.status}
                  </span>
                </div>
                <p style={{ margin: "0.65rem 0", lineHeight: 1.5 }}>{appeal.message}</p>
                <div className="appeal-card__meta">
                  <span>Submitted {new Date(appeal.submittedAt).toLocaleString()}</span>
                </div>
                {appeal.status === "pending" ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => handleResolveAppeal(appeal.id, "approve")}
                    >
                      Approve &amp; unban
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleResolveAppeal(appeal.id, "reject")}
                    >
                      Reject appeal
                    </button>
                  </div>
                ) : (
                  <div className="appeal-card__resolution">
                    <strong>Resolved {appeal.resolvedAt ? new Date(appeal.resolvedAt).toLocaleString() : ""}</strong>
                    <span>
                      by {appeal.resolvedBy ?? "system"}
                      {appeal.resolutionNote ? ` â€” ${appeal.resolutionNote}` : ""}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Blocked words */}
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>Blocked words</h3>
        <p className="section-subtitle">Applies to publishing and new reviews.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem("word") as HTMLInputElement);
            const word = input.value.trim();
            if (word) addBlockedWord(word);
            input.value = "";
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input name="word" placeholder="Add word or phrase" />
          <button type="submit" className="primary-button">Add</button>
        </form>
        <div className="chip-group" style={{ marginTop: 10 }}>
          {blockedWords.map((w) => (
            <button key={w} type="button" className="chip" title="Remove" onClick={() => removeBlockedWord(w)}>
              {w} âœ•
            </button>
          ))}
        </div>
      </motion.section>

      {/* Auto-mod tester */}
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>Automod tester</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem('sample') as HTMLInputElement);
            const value = input.value;
            const res = validateText(value);
            alert(res.ok ? 'OK (no blocked words detected)' : `Blocked: ${res.word}`);
          }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        >
          <input name="sample" placeholder="Type text to test" style={{ flex: 1, minWidth: 240 }} />
          <button className="primary-button" type="submit">Test</button>
        </form>
      </motion.section>

      {/* Data export */}
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>Local data</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              const keys = [
                'sf:workspace','sf:published-stories','sf:provider-keys','sf:provider-selected','sf:provider-custom','sf:provider-models',
                'dreamscribe_users','dreamscribe_current_user','sf:blocked-words','sf:moderation-logs'
              ];
              const dump: Record<string, unknown> = {};
              keys.forEach((k) => {
                try { dump[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch { dump[k] = localStorage.getItem(k); }
              });
              const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'dreamscribe-data.json';
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Export JSON
          </button>
        </div>
      </motion.section>

      {/* Moderation logs */}
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{ marginTop: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>Moderation logs</h3>
        {logs.length === 0 ? (
          <p className="notice--muted">No moderation events captured yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {logs.map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, opacity: 0.9 }}>
                <span>
                  <strong>{l.type}</strong> â€” {l.details || ""}
                </span>
                <time>{new Date(l.timestamp).toLocaleTimeString()}</time>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}

