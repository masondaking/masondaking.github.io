import { StoryMetadata } from "../../context/WorkspaceContext";
import { ProviderDescriptor, ProviderId } from "../../context/ProviderContext";

export interface StoryBuildRequest {
  provider: ProviderDescriptor;
  apiKey: string;
  metadata: StoryMetadata;
  prompt: string;
  temperature?: number;
  model?: string;
  maxTokens?: number;
}

export interface FeedbackBuildRequest {
  provider: ProviderDescriptor;
  apiKey: string;
  metadata: StoryMetadata;
  draft: string;
  focus: "grammar" | "dialogue" | "flow" | "custom";
  instruction: string;
  model?: string;
}

export interface AIResponse {
  content: string;
  tokensUsed?: number;
  raw?: unknown;
}

export interface AIClient {
  generateStory: (request: StoryBuildRequest) => Promise<AIResponse>;
  requestFeedback: (request: FeedbackBuildRequest) => Promise<AIResponse>;
}

export type ClientRegistry = Record<Exclude<ProviderId, `custom:${string}`>, AIClient>;

export class AIClientError extends Error {
  constructor(message: string, public readonly status?: number, public readonly payload?: unknown) {
    super(message);
    this.name = "AIClientError";
  }
}

export function assertKey(apiKey: string, provider: ProviderDescriptor) {
  if (!apiKey) {
    throw new AIClientError(`Missing API key for ${provider.label}`);
  }
}

export function withTimeout<T>(promise: Promise<T>, ms = 60000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new AIClientError("Request timed out")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export async function fetchWithHandling(
  url: RequestInfo | URL,
  init: RequestInit | undefined,
  providerLabel: string
): Promise<Response> {
  try {
    return await withTimeout(fetch(url, init));
  } catch (error) {
    if (error instanceof TypeError) {
      throw new AIClientError(
        `${providerLabel} request failed before reaching the API. If you're running locally, ensure the dev proxy is active (npm run dev) or configure a VITE_${providerLabel.replace(/\s+/g, "_").toUpperCase()}_BASE_URL override.`,
        undefined,
        { cause: String(error) }
      );
    }
    throw error;
  }
}
