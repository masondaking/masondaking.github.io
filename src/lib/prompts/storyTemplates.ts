import { StoryMetadata } from "../../context/WorkspaceContext";

export function composeStorySystemPrompt(metadata: StoryMetadata): string {
  return [
    "You are Dreamscribe, an AI co-author who crafts immersive fiction while respecting the author's voice.",
    "Write with cinematic detail, grounded emotions, and coherent pacing.",
    `Tone guidance: ${metadata.tone}`,
    `Genre: ${metadata.genre}`,
    `Narrative perspective: ${metadata.perspective}`,
    "Structure scenes with clear beats, rising tension, and satisfying payoff.",
  ].join(" ");
}

export function composeStoryUserPrompt(metadata: StoryMetadata, authorPrompt: string): string {
  return [
    `Title: ${metadata.title || "Untitled"}`,
    `Target length: ${lengthLabel(metadata.targetLength)}`,
    "Author instructions:",
    authorPrompt.trim(),
  ].join("\n\n");
}

export function composeFeedbackPrompt(metadata: StoryMetadata, draft: string, instruction: string): string {
  return [
    "You are a developmental editor critiquing a work in progress.",
    `Story title: ${metadata.title}`,
    `Genre: ${metadata.genre}`,
    `Tone: ${metadata.tone}`,
    "First provide a concise summary of your feedback, then bullet actionable revisions. Quote lines where useful.",
    "Draft:",
    draft,
    "Feedback focus:",
    instruction,
  ].join("\n\n");
}

function lengthLabel(length: StoryMetadata["targetLength"]): string {
  switch (length) {
    case "short":
      return "Flash (500-1,000 words)";
    case "medium":
      return "Short story (1,000-3,000 words)";
    case "long":
      return "Long form (3,000+ words)";
    default:
      return "Moderate";
  }
}
