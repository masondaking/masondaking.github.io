Discord Presence Watcher (osu! auto‑deafen)

Overview
- Watches a target user’s Rich Presence and infers when an osu! run is active.
- If the user is in a guild voice channel, server‑deafens while in‑run and clears deafen when run ends.
- Optional local JSON status endpoint.

Requirements
- A Discord bot in a server you’re in.
- In the Developer Portal, under Bot → Privileged Gateway Intents, enable:
  - Presence Intent
  - Server Members Intent
- Bot permissions in the server to “Deafen Members”.

Setup
1) Copy `.env.example` to `.env` and fill in values:
   - `DISCORD_BOT_TOKEN`: your bot token
   - `TARGET_USER_ID`: your own user ID
   - `GUILD_ID` (optional): limit to a single server
2) Install deps:
   - npm i discord.js dotenv
3) Invite the bot to the target server with permission to deafen members.

Run
- npm run presence:watch

Behavior
- Heuristics mark an osu! “run” when an activity named `osu!` has non‑menu details/state or a start timestamp.
- When in‑run + in voice: server‑deafens.
- When run ends or you leave voice: clears deafen.
- On shutdown, attempts to clear deafen if it set it.

Local Status (optional)
- Set `ENABLE_HTTP=true` and optionally `PORT` in `.env`.
- GET `http://localhost:6633` returns current activities and inferred state.

Notes
- Presence changes are guild‑scoped; the bot must share a server with you.
- “Server deafen” is different from client self‑deafen but achieves the same effect in guild voice.
- If your osu! presence text differs, adjust heuristics in `scripts/presence-watch.mjs`.

