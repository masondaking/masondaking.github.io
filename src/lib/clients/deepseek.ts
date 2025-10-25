import { AIClient, AIClientError, FeedbackBuildRequest, StoryBuildRequest, fetchWithHandling } from "./base";
import { composeFeedbackPrompt, composeStorySystemPrompt, composeStoryUserPrompt } from "../prompts/storyTemplates";

const envUrl = import.meta.env.VITE_DEEPSEEK_BASE_URL?.trim();
const DEEPSEEK_URL =
  envUrl && envUrl.length > 0
    ? envUrl
    : import.meta.env.DEV
    ? "/__dreamscribe/deepseek"
    : "https://api.deepseek.com/chat/completions";

async function postDeepSeek(apiKey: string, body: unknown) {
  const response = await fetchWithHandling(
    DEEPSEEK_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    "DeepSeek"
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const detail =
      (payload as { error?: { message?: string } } | undefined)?.error?.message?.trim() ?? "";
    const message = detail ? `DeepSeek error (${response.status}): ${detail}` : `DeepSeek error (${response.status})`;
    throw new AIClientError(message, response.status, payload);
  }

  return response.json();
}

export const deepSeekClient: AIClient = {
  async generateStory(request: StoryBuildRequest) {
    const body = {
      model: request.model ?? request.provider.defaultModel,
      temperature: request.temperature ?? 0.65,
      max_tokens: request.maxTokens ?? 1400,
      messages: [
        { role: "system", content: composeStorySystemPrompt(request.metadata) },
        { role: "user", content: composeStoryUserPrompt(request.metadata, request.prompt) },
      ],
    };

    const data = await postDeepSeek(request.apiKey, body);
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new AIClientError("DeepSeek returned an empty response", undefined, data);
    }
    return { content, tokensUsed: data.usage?.total_tokens, raw: data };
  },

  async requestFeedback(request: FeedbackBuildRequest) {
    const body = {
      model: request.model ?? request.provider.defaultModel,
      temperature: 0.4,
      max_tokens: 900,
      messages: [
        { role: "system", content: "You are a careful fiction editor." },
        { role: "user", content: composeFeedbackPrompt(request.metadata, request.draft, request.instruction) },
      ],
    };

    const data = await postDeepSeek(request.apiKey, body);
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new AIClientError("DeepSeek returned an empty feedback response", undefined, data);
    }
    return { content, tokensUsed: data.usage?.total_tokens, raw: data };
  },
};
