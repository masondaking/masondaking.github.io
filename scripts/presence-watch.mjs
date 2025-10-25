import 'dotenv/config';
import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import http from 'node:http';

// --- Config ---
const TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
const GUILD_ID = process.env.GUILD_ID || '';
const ENABLE_HTTP = /^true$/i.test(String(process.env.ENABLE_HTTP || ''));
const HTTP_PORT = Number(process.env.PORT || 6633);

if (!TOKEN || !TARGET_USER_ID) {
  console.error('[presence-watch] Missing required env: DISCORD_BOT_TOKEN and TARGET_USER_ID');
  process.exit(1);
}

// --- State ---
let inRun = false;
let lastDecision = 'idle';
let lastDeafenGuildId = null;
let currentVoiceGuildId = null;
let latestSnapshot = {
  updatedAt: null,
  userId: TARGET_USER_ID,
  activities: [],
  inferred: { isOsu: false, inRun: false },
};

// --- Utils ---
const typeName = (t) => {
  switch (t) {
    case ActivityType.Playing: return 'Playing';
    case ActivityType.Streaming: return 'Streaming';
    case ActivityType.Listening: return 'Listening';
    case ActivityType.Watching: return 'Watching';
    case ActivityType.Custom: return 'Custom';
    case ActivityType.Competing: return 'Competing';
    default: return String(t);
  }
};

function snapshotPresence(presence) {
  const activities = (presence?.activities || []).map((a) => ({
    id: a.id ?? null,
    name: a.name,
    type: typeName(a.type),
    details: a.details ?? null,
    state: a.state ?? null,
    applicationId: a.applicationId ?? null,
    timestamps: a.timestamps
      ? { start: a.timestamps.start ?? null, end: a.timestamps.end ?? null }
      : null,
    assets: a.assets
      ? {
          largeText: a.assets.largeText ?? null,
          smallText: a.assets.smallText ?? null,
        }
      : null,
  }));

  const osu = activities.find((a) => (a.name || '').toLowerCase() === 'osu!');
  const isOsu = Boolean(osu);
  const runHeuristics = (() => {
    if (!osu) return false;
    const text = `${osu.details || ''} ${osu.state || ''}`.toLowerCase();
    if (!text.trim()) return false; // often menus have empty details/state
    const bad = ['menu', 'menus', 'editing', 'selecting', 'idle'];
    if (bad.some((k) => text.includes(k))) return false;
    const good = ['playing', 'ranked', 'map', 'multiplayer', 'solo', 'osu!'];
    return good.some((k) => text.includes(k)) || Boolean(osu.timestamps?.start);
  })();

  latestSnapshot = {
    updatedAt: new Date().toISOString(),
    userId: TARGET_USER_ID,
    activities,
    inferred: { isOsu, inRun: runHeuristics },
  };

  return { isOsu, inRun: runHeuristics, osuActivity: osu };
}

function logActivities(prefix, presence) {
  const acts = presence?.activities || [];
  console.log(`[presence-watch] ${prefix}: ${acts.length} activities`);
  for (const a of acts) {
    console.log(
      `  - ${typeName(a.type)} ${a.name}` +
        (a.details ? ` | details: ${a.details}` : '') +
        (a.state ? ` | state: ${a.state}` : '')
    );
  }
}

async function setServerDeafen(member, value, reason) {
  if (!member?.voice?.channelId) return false;
  if (member.voice.serverDeaf === value) return true;
  try {
    await member.edit({ deaf: value }, reason);
    lastDeafenGuildId = member.guild.id;
    console.log(`[presence-watch] ${value ? 'Deafened' : 'Undeafened'} @ ${member.guild.name} (${reason})`);
    return true;
  } catch (err) {
    console.error('[presence-watch] Failed to edit deafen:', err?.message || err);
    return false;
  }
}

function findMemberWithVoice(client) {
  for (const g of client.guilds.cache.values()) {
    const m = g.members.cache.get(TARGET_USER_ID);
    if (m?.voice?.channelId) return m;
  }
  return null;
}

// --- Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.GuildMember],
});

client.once(Events.ClientReady, async () => {
  console.log(`[presence-watch] Logged in as ${client.user.tag}`);

  const guilds = GUILD_ID
    ? [await client.guilds.fetch(GUILD_ID).catch(() => null)].filter(Boolean)
    : [...client.guilds.cache.values()];

  if (guilds.length === 0) {
    console.warn('[presence-watch] Bot is not in any guilds or GUILD_ID invalid.');
  }

  // Preload target member into cache for presence/voice reads.
  for (const g of guilds) {
    try {
      const guild = await g.fetch?.() || g;
      await guild.members.fetch({ user: TARGET_USER_ID, force: true }).catch(() => {});
    } catch {}
  }

  // Try to print initial presence if available
  for (const g of guilds) {
    const guild = await g.fetch?.() || g;
    const m = guild.members.cache.get(TARGET_USER_ID);
    if (m?.presence) {
      logActivities(`Initial presence in ${guild.name}`, m.presence);
      const { inRun: r } = snapshotPresence(m.presence);
      inRun = r;
      lastDecision = r ? 'in-run' : 'not-in-run';
      break;
    }
  }

  // Track current voice guild for the user
  const vm = findMemberWithVoice(client);
  currentVoiceGuildId = vm?.guild?.id || null;

  // On startup, if already in run + in voice, deafen.
  if (inRun && currentVoiceGuildId) {
    const guild = client.guilds.cache.get(currentVoiceGuildId);
    const member = guild?.members.cache.get(TARGET_USER_ID);
    if (member) await setServerDeafen(member, true, 'startup: already in osu run');
  }
});

client.on(Events.PresenceUpdate, async (_old, next) => {
  if (!next || next.userId !== TARGET_USER_ID) return;
  const { inRun: nextInRun } = snapshotPresence(next);
  logActivities('Presence update', next);

  inRun = nextInRun;
  lastDecision = inRun ? 'in-run' : 'not-in-run';

  // Act only if in voice somewhere
  const member = findMemberWithVoice(client);
  if (!member) return;
  currentVoiceGuildId = member.guild.id;

  if (inRun) {
    await setServerDeafen(member, true, 'presence: osu run detected');
  } else {
    await setServerDeafen(member, false, 'presence: osu run ended');
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const isTarget = oldState.id === TARGET_USER_ID || newState.id === TARGET_USER_ID;
  if (!isTarget) return;

  const member = newState.member || oldState.member;
  const nowInVoice = Boolean(newState.channelId);
  currentVoiceGuildId = nowInVoice ? newState.guild.id : null;

  if (!member) return;

  if (nowInVoice && inRun) {
    await setServerDeafen(member, true, 'voice: joined during run');
  }
  if (!nowInVoice && oldState?.serverDeaf) {
    // Safety: clear server deaf on leave
    try { await setServerDeafen(member, false, 'voice: left channel'); } catch {}
  }
});

// Optional tiny HTTP endpoint to view latest presence
let server = null;
if (ENABLE_HTTP) {
  server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      updatedAt: latestSnapshot.updatedAt,
      userId: latestSnapshot.userId,
      activities: latestSnapshot.activities,
      inferred: latestSnapshot.inferred,
      decision: { inRun, lastDecision, currentVoiceGuildId, lastDeafenGuildId },
    }));
  });
  server.listen(HTTP_PORT, () => {
    console.log(`[presence-watch] HTTP status on http://localhost:${HTTP_PORT}`);
  });
}

async function gracefulExit() {
  try {
    // Try to undeafen if we previously deafened
    if (lastDeafenGuildId) {
      const guild = client.guilds.cache.get(lastDeafenGuildId);
      const member = guild?.members.cache.get(TARGET_USER_ID);
      if (member?.voice?.serverDeaf) {
        await setServerDeafen(member, false, 'shutdown: cleanup');
      }
    }
  } catch {}
  try { if (server) server.close(); } catch {}
  try { client.destroy(); } catch {}
  process.exit(0);
}

process.on('SIGINT', gracefulExit);
process.on('SIGTERM', gracefulExit);

client.login(TOKEN).catch((e) => {
  console.error('[presence-watch] Login failed:', e?.message || e);
  process.exit(1);
});

