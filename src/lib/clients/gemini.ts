import { AIClient, AIClientError, FeedbackBuildRequest, StoryBuildRequest, fetchWithHandling } from "./base";
import { composeFeedbackPrompt, composeStorySystemPrompt, composeStoryUserPrompt } from "../prompts/storyTemplates";

const envUrl = import.meta.env.VITE_GEMINI_BASE_URL?.trim();
const GEMINI_BASE =
  envUrl && envUrl.length > 0
    ? envUrl.replace(/\/$/, "")
    : import.meta.env.DEV
    ? "/__dreamscribe/gemini"
    : "https://generativelanguage.googleapis.com";

function geminiEndpoint(model: string, apiKey: string) {
  const prefix = GEMINI_BASE.endsWith("/") ? GEMINI_BASE.slice(0, -1) : GEMINI_BASE;
  return `${prefix}/v1/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function postGemini(url: string, body: unknown) {
  const response = await fetchWithHandling(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    "Gemini"
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    const detail =
      (payload as { error?: { message?: string } } | undefined)?.error?.message?.trim() ?? "";
    const message = detail ? `Gemini error (${response.status}): ${detail}` : `Gemini error (${response.status})`;
    throw new AIClientError(message, response.status, payload);
  }

  return response.json();
}

function extractText(candidate: any): string | undefined {
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  return parts
    .map((part) => part?.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function modelFallbacks(model: string): string[] {
  const fallbacks: string[] = [model];
  if (/^gemini-1\.5-flash$/.test(model)) fallbacks.push("gemini-1.5-flash-001");
  if (/^gemini-1\.5-flash-8b$/.test(model)) fallbacks.push("gemini-1.5-flash-8b-001");
  if (/^gemini-1\.5-pro$/.test(model)) fallbacks.push("gemini-1.5-pro-001");
  if (/^gemini-pro$/.test(model)) fallbacks.push("gemini-1.5-pro", "gemini-1.5-pro-001");
  return Array.from(new Set(fallbacks));
}

export const geminiClient: AIClient = {
  async generateStory(request: StoryBuildRequest) {
    const model = request.model ?? request.provider.defaultModel;
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                composeStorySystemPrompt(request.metadata) +
                "\n\n" +
                composeStoryUserPrompt(request.metadata, request.prompt),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: request.temperature ?? 0.75,
        maxOutputTokens: request.maxTokens ?? 1400,
      },
    } as const;

    const candidates = modelFallbacks(model);
    let lastErr: unknown;
    for (const m of candidates) {
      try {
        const url = geminiEndpoint(m, request.apiKey);
        const data = await postGemini(url, body);
        const candidate = data.candidates?.[0];
        const text = extractText(candidate);
        if (!text) {
          throw new AIClientError("Gemini returned an empty response", undefined, data);
        }
        return { content: text, raw: data };
      } catch (err) {
        const e = err as AIClientError;
        const msg = String((e && (e.message || (e as any).payload)) || "").toLowerCase();
        const is404 = (e && e.status === 404) || msg.includes("not found");
        if (!is404 || m === candidates[candidates.length - 1]) {
          lastErr = err;
          break;
        }
        lastErr = err;
        // try next fallback
      }
    }
    throw lastErr as Error;
  },

  async requestFeedback(request: FeedbackBuildRequest) {
    const model = request.model ?? request.provider.defaultModel;
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "You are an expert fiction editor offering constructive feedback." +
                "\n\n" +
                composeFeedbackPrompt(request.metadata, request.draft, request.instruction),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 900,
      },
    } as const;

    const candidates = modelFallbacks(model);
    let lastErr: unknown;
    for (const m of candidates) {
      try {
        const url = geminiEndpoint(m, request.apiKey);
        const data = await postGemini(url, body);
        const candidate = data.candidates?.[0];
        const text = extractText(candidate);
        if (!text) {
          throw new AIClientError("Gemini returned an empty feedback response", undefined, data);
        }
        return { content: text, raw: data };
      } catch (err) {
        const e = err as AIClientError;
        const msg = String((e && (e.message || (e as any).payload)) || "").toLowerCase();
        const is404 = (e && e.status === 404) || msg.includes("not found");
        if (!is404 || m === candidates[candidates.length - 1]) {
          lastErr = err;
          break;
        }
        lastErr = err;
      }
    }
    throw lastErr as Error;
  },
};
