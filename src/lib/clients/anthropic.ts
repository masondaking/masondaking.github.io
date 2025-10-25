import { AIClient, AIClientError, FeedbackBuildRequest, StoryBuildRequest, fetchWithHandling } from "./base";
import { composeFeedbackPrompt, composeStorySystemPrompt, composeStoryUserPrompt } from "../prompts/storyTemplates";

const envUrl = import.meta.env.VITE_ANTHROPIC_BASE_URL?.trim();
const ANTHROPIC_URL =
  envUrl && envUrl.length > 0
    ? envUrl
    : import.meta.env.DEV
    ? "/__dreamscribe/anthropic"
    : "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

async function postAnthropic(apiKey: string, body: unknown) {
  const response = await fetchWithHandling(
    ANTHROPIC_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    },
    "Anthropic"
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const detail =
      (payload as { error?: { message?: string } } | undefined)?.error?.message?.trim() ?? "";
    const message = detail ? `Anthropic error (${response.status}): ${detail}` : `Anthropic error (${response.status})`;
    throw new AIClientError(message, response.status, payload);
  }

  return response.json();
}

export const anthropicClient: AIClient = {
  async generateStory(request: StoryBuildRequest) {
    const body = {
      model: request.model ?? request.provider.defaultModel,
      max_tokens: request.maxTokens ?? 1500,
      temperature: request.temperature ?? 0.7,
      system: composeStorySystemPrompt(request.metadata),
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: composeStoryUserPrompt(request.metadata, request.prompt) }],
        },
      ],
    };

    const data = await postAnthropic(request.apiKey, body);
    const text = data.content?.[0]?.text?.trim();
    if (!text) {
      throw new AIClientError("Anthropic returned an empty response", undefined, data);
    }
    return { content: text, tokensUsed: data.usage?.output_tokens, raw: data };
  },

  async requestFeedback(request: FeedbackBuildRequest) {
    const body = {
      model: request.model ?? request.provider.defaultModel,
      max_tokens: 900,
      temperature: 0.3,
      system: "You are a precise, encouraging fiction editor.",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: composeFeedbackPrompt(request.metadata, request.draft, request.instruction) }],
        },
      ],
    };

    const data = await postAnthropic(request.apiKey, body);
    const text = data.content?.[0]?.text?.trim();
    if (!text) {
      throw new AIClientError("Anthropic returned an empty feedback response", undefined, data);
    }
    return { content: text, tokensUsed: data.usage?.output_tokens, raw: data };
  },
};
