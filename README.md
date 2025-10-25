# Dreamscribe

Dreamscribe is a multi-model storytelling studio with a cinematic landing page, local auth, collaborative AI writing tools, and a shareable library. Generate scenes with OpenAI, Anthropic, Gemini, or DeepSeek, polish drafts with targeted feedback, and publish your favourites to the community shelf.

## Quick start

```bash
npm install
npm run dev
```

Scripts:

- `npm run dev` – start Vite dev server on http://localhost:5173
- `npm run build` – type-check and create a production build
- `npm run preview` – preview the production bundle locally

> **Note**: Dependencies are declared but not yet installed. Run `npm install` from the project root before starting the dev server.

## Bring your own API keys

Dreamscribe keeps secrets in the browser. Before you can generate text or request feedback:

1. Open the Studio (`/studio`) and choose an AI provider.
2. Paste your API key (OpenAI, Anthropic, Gemini, or DeepSeek) into the provider key field.
3. Keys are cached in `localStorage` only—Dreamscribe never transmits them to a server.

| Provider | Endpoint | Default model |
| --- | --- | --- |
| OpenAI | `POST https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` |
| Anthropic | `POST https://api.anthropic.com/v1/messages` | `claude-3-5-haiku-latest` |
| Google Gemini | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `gemini-1.5-flash` |
| DeepSeek | `POST https://api.deepseek.com/chat/completions` | `deepseek-chat` |

Custom providers can be registered in the UI, but no connector ships by default for security reasons.

## Features

- **Immersive landing experience** – Orbiting gradient animations, staged hero text, feature grid, workflow timeline, animated pricing, FAQ, and footer credit (“Made by Reno and Mason”).
- **Local auth & security** – Hashed credentials, persistent sessions, guarded studio route, and local-only key storage.
- **Story studio**
  - Prompt builder with tone/genre/POV controls and per-provider model selection.
  - Expanded model menus for OpenAI, Anthropic, Gemini, and DeepSeek with quick switching.
  - Multi-AI generation, dialogue/structure feedback passes, and inline debug console logging.
  - Publish workflow with summary/tags so you can share drafts to the community shelf.
- **Achievements & collections** – Unlock badges as you publish and review, and organise favourites into personal shelves.
- **Public library** – `/stories` showcases published tales with animated cards, average ratings, and quick navigation.
- **Story detail view** – Full prose display, quick-reference story metadata, collection controls, star reviews, and community comment log.
- **Debug console** – Toggle via navbar or `Alt + D`; filter requests/responses/errors and copy payloads for troubleshooting.

## Project structure

```
+-- docs/
¦   +-- architecture.md
+-- public/
¦   +-- favicon.svg
+-- src/
¦   +-- components/
¦   ¦   +-- debug/
¦   ¦   +-- library/
¦   ¦   +-- layout/
¦   ¦   +-- navigation/
¦   ¦   +-- ui/
¦   ¦   +-- workspace/
¦   +-- context/
¦   +-- hooks/
¦   +-- lib/
¦   ¦   +-- clients/
¦   ¦   +-- prompts/
¦   +-- pages/
¦   ¦   +-- Auth/
¦   ¦   +-- Landing/
¦   ¦   +-- Library/
¦   ¦   +-- Workspace/
¦   +-- styles/
¦   +-- utils/
+-- index.html
+-- package.json
+-- vite.config.ts
```

Refer to [`docs/architecture.md`](docs/architecture.md) for a deeper breakdown of flows and module responsibilities.

## Debugging & instrumentation

- Every generation, feedback, and publish request logs to the in-app console with sanitized payloads.
- Use the “Debug” button in the navigation bar or press `Alt + D` to toggle the overlay.
- Filter events (info/request/response/error), inspect payloads, copy JSON, or clear the feed.

## Roadmap suggestions

- Sync published stories and reviews to a hosted backend for multi-device access.
- Stream AI tokens in real time with cost telemetry and smarter retry heuristics for 429s.
- Add collaborative editing, inline comments, and reader shelving/bookmarks.
- Extend custom provider support with user-supplied headers/bodies and validation playgrounds.
