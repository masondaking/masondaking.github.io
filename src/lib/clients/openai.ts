import { AIClient, AIClientError, FeedbackBuildRequest, StoryBuildRequest, fetchWithHandling } from "./base";
import { composeFeedbackPrompt, composeStorySystemPrompt, composeStoryUserPrompt } from "../prompts/storyTemplates";

const envUrl = import.meta.env.VITE_OPENAI_BASE_URL?.trim();
const OPENAI_URL =
  envUrl && envUrl.length > 0
    ? envUrl
    : import.meta.env.DEV
    ? "/__dreamscribe/openai"
    : "https://api.openai.com/v1/responses";
const OPENAI_MODELS_URL =
  envUrl && envUrl.length > 0
    ? envUrl.replace(/\/responses$/, "/models")
    : import.meta.env.DEV
    ? "/__dreamscribe/openai-models"
    : "https://api.openai.com/v1/models";

async function postResponses(apiKey: string, body: unknown) {
  const response = await fetchWithHandling(
    OPENAI_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    "OpenAI"
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const detail =
      (payload as { error?: { message?: string } } | undefined)?.error?.message?.trim() ?? "";
    const message = detail ? `OpenAI error (${response.status}): ${detail}` : `OpenAI error (${response.status})`;
    throw new AIClientError(message, response.status, payload);
  }

  return response.json();
}

function buildCandidateOrder(preferred: string | undefined, providerDefault: string) {
  const candidates = [
    preferred ?? providerDefault,
    providerDefault,
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4o-mini-2024-07-18",
    "gpt-4o-2024-08-06",
  ];
  return Array.from(new Set(candidates.filter(Boolean)));
}

type OpenAIResponse = {
  output_text?: string[];
  output?: Array<{ type?: string; text?: string }>;
  response?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: { total_tokens?: number; output_tokens?: number };
};

function extractText(data: OpenAIResponse) {
  if (Array.isArray(data.output_text) && data.output_text.length) {
    return data.output_text.join("\n").trim();
  }
  if (Array.isArray(data.output) && data.output.length) {
    const merged = data.output
      .map((entry) => ("text" in entry && typeof entry.text === "string" ? entry.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (merged) return merged;
  }
  if (Array.isArray(data.response) && data.response.length) {
    const merged = data.response
      .flatMap((entry) => entry.content ?? [])
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (merged) return merged;
  }
  return "";
}

async function generateWithFallback<T>(
  apiKey: string,
  models: string[],
  buildBody: (model: string) => unknown,
  parse: (data: OpenAIResponse) => T
): Promise<T> {
  let lastError: unknown;
  const available = await filterAvailableModels(apiKey, models);
  if (available.length === 0) {
    throw new AIClientError(
      "OpenAI models unavailable. This API key does not have access to gpt-4o or gpt-4o-mini.",
      404
    );
  }
  for (const model of available) {
    try {
      const data = await postResponses(apiKey, buildBody(model));
      return parse(data);
    } catch (error) {
      const aiError = error as unknown;
      if (aiError instanceof AIClientError && aiError.status === 404) {
        lastError = aiError;
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new AIClientError("OpenAI returned 404 for all fallback models");
}

const availabilityCache = new Map<string, { timestamp: number; models: Set<string> }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function filterAvailableModels(apiKey: string, candidates: string[]): Promise<string[]> {
  const cache = availabilityCache.get(apiKey);
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return candidates.filter((model) => cache.models.has(model));
  }

  const available = new Set<string>();
  await Promise.all(
    candidates.map(async (model) => {
      if (!model) return;
      try {
        const response = await fetchWithHandling(
          `${OPENAI_MODELS_URL}/${encodeURIComponent(model)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
          "OpenAI"
        );
        if (response.ok) {
          available.add(model);
        }
      } catch (error) {
        // swallow to continue checking other models
      }
    })
  );

  if (available.size === 0) {
    availabilityCache.set(apiKey, { timestamp: now, models: new Set() });
    return [];
  }

  availabilityCache.set(apiKey, { timestamp: now, models: available });
  return candidates.filter((model) => available.has(model));
}

export const openAIClient: AIClient = {
  async generateStory(request: StoryBuildRequest) {
    const system = composeStorySystemPrompt(request.metadata);
    const user = composeStoryUserPrompt(request.metadata, request.prompt);
    const candidates = buildCandidateOrder(request.model, request.provider.defaultModel);

    return await generateWithFallback(
      request.apiKey,
      candidates,
      (model) => ({
        model,
        max_output_tokens: request.maxTokens ?? 1400,
        temperature: request.temperature ?? 0.7,
        input: [
          {
            role: "system",
            content: [{ type: "text", text: system }],
          },
          {
            role: "user",
            content: [{ type: "text", text: user }],
          },
        ],
      }),
      (data) => {
        const content = extractText(data);
        if (!content) {
          throw new AIClientError("OpenAI returned an empty response", undefined, data);
        }
        return {
          content,
          tokensUsed: data.usage?.total_tokens ?? data.usage?.output_tokens,
          raw: data,
        };
      }
    );
  },

  async requestFeedback(request: FeedbackBuildRequest) {
    const prompt = composeFeedbackPrompt(request.metadata, request.draft, request.instruction);
    const candidates = buildCandidateOrder(request.model, request.provider.defaultModel);

    return await generateWithFallback(
      request.apiKey,
      candidates,
      (model) => ({
        model,
        max_output_tokens: 900,
        temperature: 0.4,
        input: [
          {
            role: "system",
            content: [{ type: "text", text: "You are a world-class fiction editor offering constructive critiques." }],
          },
          {
            role: "user",
            content: [{ type: "text", text: prompt }],
          },
        ],
      }),
      (data) => {
        const content = extractText(data);
        if (!content) {
          throw new AIClientError("OpenAI returned an empty feedback response", undefined, data);
        }
        return {
          content,
          tokensUsed: data.usage?.total_tokens ?? data.usage?.output_tokens,
          raw: data,
        };
      }
    );
  },
};
