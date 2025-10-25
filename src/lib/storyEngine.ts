import { ProviderDescriptor, ProviderId } from "../context/ProviderContext";
import { FeedbackBuildRequest, StoryBuildRequest, AIClientError } from "./clients/base";
import { openAIClient } from "./clients/openai";
import { anthropicClient } from "./clients/anthropic";
import { geminiClient } from "./clients/gemini";
import { deepSeekClient } from "./clients/deepseek";

const registry = {
  openai: openAIClient,
  anthropic: anthropicClient,
  gemini: geminiClient,
  deepseek: deepSeekClient,
} satisfies Record<Exclude<ProviderId, `custom:${string}`>, typeof openAIClient>;

function getClient(provider: ProviderDescriptor) {
  if (provider.id.startsWith("custom:")) {
    throw new AIClientError("Custom providers require a user-supplied connector.");
  }
  return registry[provider.id as keyof typeof registry];
}

export function buildStoryRequest(input: Omit<StoryBuildRequest, "provider"> & { provider: ProviderDescriptor }): StoryBuildRequest {
  return { ...input };
}

export function buildFeedbackRequest(
  input: Omit<FeedbackBuildRequest, "provider"> & { provider: ProviderDescriptor }
): FeedbackBuildRequest {
  return { ...input };
}

export async function generateStory(request: StoryBuildRequest) {
  const client = getClient(request.provider);
  try {
    return await client.generateStory(request);
  } catch (err) {
    const e = err as unknown;
    const payloadText =
      e instanceof AIClientError && e.payload ? JSON.stringify(e.payload).toLowerCase() : "";
    const isModelError =
      e instanceof AIClientError &&
      (e.status === 404 ||
        e.message.toLowerCase().includes("model") ||
        payloadText.includes("model") ||
        e.message.toLowerCase().includes("does not exist"));
    const fallback = request.provider.defaultModel;
    if (isModelError && request.model !== fallback) {
      // retry with provider default model
      return await client.generateStory({ ...request, model: fallback });
    }
    throw err;
  }
}

export async function requestFeedback(request: FeedbackBuildRequest) {
  const client = getClient(request.provider);
  try {
    return await client.requestFeedback(request);
  } catch (err) {
    const e = err as unknown;
    const payloadText =
      e instanceof AIClientError && e.payload ? JSON.stringify(e.payload).toLowerCase() : "";
    const isModelError =
      e instanceof AIClientError &&
      (e.status === 404 ||
        e.message.toLowerCase().includes("model") ||
        payloadText.includes("model") ||
        e.message.toLowerCase().includes("does not exist"));
    const fallback = request.provider.defaultModel;
    if (isModelError && request.model !== fallback) {
      return await client.requestFeedback({ ...request, model: fallback });
    }
    throw err;
  }
}
