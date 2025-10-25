# Dreamscribe Architecture

## Stack Overview
- Build tool: Vite + TypeScript + React 18 for fast iterations and modern DX.
- Routing: React Router v6 drives the marketing site, auth flow, studio workspace, public library, and story detail pages.
- Styling: Global CSS with design tokens, glassmorphism utilities, and bespoke Framer Motion animations for hero orbits, section reveals, and card cascades.
- State Management: React contexts for auth, AI provider registry, creation workspace + story memory, achievements/collections, debug console, and the published-story library.
- Persistence: Browser `localStorage` keeps auth sessions, API keys, workspace drafts, achievements, collections, and the shared story catalogue.
- Networking: Fetch-based adapters for OpenAI, Anthropic, Google Gemini, and DeepSeek with unified error surfaces and debug logging.
- Tooling: Vite dev server, strict TypeScript, optional ESLint/Prettier, and API abstraction modules for future swapping.

## High-Level Flow
1. Visitors land on the animated **LandingPage** with staged hero animations, orbiting gradients, and CTAs into the studio or public library.
2. Auth state (`AuthContext`) stores salted+hashed credentials locally and guards `/studio` routes.
3. `WorkspaceProvider` manages in-progress drafts, metadata, feedback threads, and debug log fan-out for AI calls.
4. `ProviderRegistryProvider` keeps multi-model selections + per-provider API keys while the debug console surfaces every request/response/error.
5. `LibraryContext` persists published stories and reviews; `AchievementsContext` reacts to those events to unlock badges, track stats, and manage user collections.
6. Readers browse `/stories`, explore achievements/collections, and leave reviews that immediately update local state.

## Key Modules
- `src/context/AuthContext.tsx`: Local credential store, session management, and login/signup helpers.
- `src/context/ProviderContext.tsx`: Multi-provider registry with key/model persistence and selector helpers.
- `src/context/WorkspaceContext.tsx`: Draft lifecycle management (metadata, prompt, content, feedback threads).
- `src/context/AchievementsContext.tsx`: Unlock logic, achievement stats, and personal collections with `localStorage` persistence.
- `src/context/LibraryContext.tsx`: Published story catalogue and review ledger.
- `src/components/debug/DebugConsole.tsx`: Overlay console with filters, payload copy, and hotkey toggle.
- `src/components/library/*`: Cards, review list, and other shared library UI.
- `src/pages/Workspace/StoryBuilderPage.tsx`: Studio UI with generation, feedback, and publishing pipeline.
- `src/pages/Library/LibraryPage.tsx` & `StoryDetailPage.tsx`: Public library grid, achievement dashboard, story metadata, collection controls, and review form.

## Data Model
```
type StoryDraft = {
  id: string;
  metadata: StoryMetadata;
  prompt: string;
  generatedAt?: string;
  content: string;
  feedbackThreads: FeedbackThread[];
};

type FeedbackThread = {
  id: string;
  provider: string;
  focus: 'grammar' | 'dialogue' | 'flow' | 'custom';
  request: string;
  response: string;
  createdAt: string;
};

type StoryReview = {
  id: string;
  storyId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type PublishedStory = {
  id: string;
  authorId: string;
  authorName: string;
  metadata: StoryMetadata;
  content: string;
  summary: string;
  tags: string[];
  publishedAt: string;
  reviews: StoryReview[];
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  unlockedAt: string;
};

type Collection = {
  id: string;
  name: string;
  createdAt: string;
  stories: { id: string; title: string; authorName: string }[];
};
```

## Debugging & Instrumentation
- `DebugProvider` aggregates structured events from generation, feedback, publishing, and collection events.
- `Alt + D` or the nav “Debug” button toggles the console overlay; payloads can be filtered and copied.
- Requests log sanitized metadata (no API secrets) along with response timing and model identifiers.

## Directory Layout
```
+-- public/
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
+-- docs/
+-- README.md
```

## Future Enhancements
- Sync published stories + reviews to a hosted backend (Supabase/Firebase) for cross-device sharing.
- Live co-authoring with CRDT-backed collaboration and inline comment threads.
- Streaming token visualiser for AI providers with cost telemetry per draft.
- Reader shelves and bookmarking, plus richer discovery surfaces for the public library.
