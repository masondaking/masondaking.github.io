import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wand2,
  MessageSquare,
  AlignLeft,
  Download,
  Copy,
  Sparkles,
  ExternalLink,
  Upload,
  Loader2,
} from "lucide-react";
import { StoryMetadataForm } from "../../components/workspace/StoryMetadataForm";
import { PromptPalettePanel } from "../../components/workspace/PromptPalettePanel";
import { ModelABExplorerPanel } from "../../components/workspace/ModelABExplorerPanel";
import { ContinuityCoachPanel } from "../../components/workspace/ContinuityCoachPanel";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  useWorkspace,
  StoryMetadata,
  PromptRecipe,
  PromptRecipeInput,
  ModelABExperiment,
  ModelVariantResult,
  ContinuityEntry,
  ContinuityEntryInput,
  ContinuityEntryType,
  SensoryPass,
  SensoryPassType,
} from "../../context/WorkspaceContext";
import { useProviderRegistry } from "../../context/ProviderContext";
import type { ProviderDescriptor, ProviderId } from "../../context/ProviderContext";
import type { ContinuityWarning } from "../../components/workspace/ContinuityCoachPanel";
import { useDebug } from "../../context/DebugContext";
import { generateStory, requestFeedback } from "../../lib/storyEngine";
import { AIClientError } from "../../lib/clients/base";
import { useLibrary } from "../../context/LibraryContext";
import { useAuth } from "../../context/AuthContext";
import { useAchievements } from "../../context/AchievementsContext";
import { generateCoverDataUrl, COVER_STYLES } from "../../lib/imageEngine";
import { generateId } from "../../utils/crypto";

const defaultMetadata: StoryMetadata = {
  title: "Untitled Tale",
  genre: "Speculative fiction",
  tone: "Evocative and character-driven",
  perspective: "Close third person",
  targetLength: "medium",
};

const defaultPrompt = `You are a collaborative storytelling assistant. Craft an engaging story that follows the author's intent. Focus on vivid sensory details, grounded character motivations, and strong pacing.`;
const defaultSummary = "A new story ready for its first sparks of inspiration.";

function tokensFor(metadata: StoryMetadata): number {
  if (metadata.targetTokens && Number.isFinite(metadata.targetTokens) && metadata.targetTokens > 0) {
    return Math.floor(metadata.targetTokens);
  }
  switch (metadata.targetLength) {
    case "short":
      return 900;
    case "medium":
      return 1500;
    case "long":
      return 2200;
    default:
      return 1400;
  }
}

type CostRate = { input: number; output: number };

const PROVIDER_COST_RATES: Record<string, CostRate> = {
  openai: { input: 0.00015, output: 0.0006 },
  anthropic: { input: 0.0008, output: 0.003 },
  gemini: { input: 0.000125, output: 0.000375 },
  deepseek: { input: 0.0002, output: 0.0004 },
  default: { input: 0.0002, output: 0.0006 },
};

function estimateGenerationCost(providerId: ProviderId, tokens: number): number {
  const key = providerId.startsWith("custom") ? "default" : providerId;
  const rates = PROVIDER_COST_RATES[key] ?? PROVIDER_COST_RATES.default;
  const total = (tokens / 1000) * (rates.input + rates.output);
  return Number(total.toFixed(3));
}

const CONTINUITY_STOP_WORDS = new Set([
  "The",
  "They",
  "Their",
  "Them",
  "That",
  "This",
  "With",
  "From",
  "Into",
  "And",
  "But",
  "She",
  "Her",
  "He",
  "His",
  "Its",
  "For",
  "When",
  "Where",
  "While",
  "Once",
  "Upon",
]);

const SENSORY_PASS_CONFIG: Record<SensoryPassType, { label: string; description: string; instruction: string }> = {
  sensory: {
    label: "Sensory detail",
    description: "Layer richer sense impressions into the current draft.",
    instruction:
      "Enhance the provided excerpt by weaving in vivid sensory details across sight, sound, smell, taste, and touch. Preserve plot, character voice, and approximate length. Return the rewritten passage only.",
  },
  dialogue: {
    label: "Dialogue polish",
    description: "Sharpen voices, subtext, and conversational rhythm.",
    instruction:
      "Review the excerpt and return a refined version that tightens dialogue, strengthens subtext, and keeps character voices consistent. Maintain story beats and format.",
  },
  pacing: {
    label: "Pacing tighten",
    description: "Speed up slack moments without losing clarity.",
    instruction:
      "Identify sluggish portions of the excerpt and rewrite them for brisker pacing while preserving essential information. Respond with the adjusted prose and brief inline notes for major cuts.",
  },
};

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AIClientError) {
    const payload = error.payload as { error?: { message?: string; code?: string; type?: string; detail?: string } } | undefined;
    const extra = payload?.error?.message || payload?.error?.detail || payload?.error?.type || payload?.error?.code;
    return extra ? `${error.message}: ${extra}` : error.message;
  }
  if (error instanceof Error) {
    return `${fallback}: ${error.message}`;
  }
  return fallback;
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`));
}

export function StoryBuilderPage() {
  const navigate = useNavigate();
  const { publishStory } = useLibrary();
  const { user } = useAuth();
  const { recordStoryPublished } = useAchievements();
  const {
    drafts,
    activeDraft,
    createDraft,
    updateDraft,
    selectDraft,
    addFeedback,
    promptRecipes,
    createPromptRecipe,
    deletePromptRecipe,
    addContinuityEntry,
    updateContinuityEntry,
    deleteContinuityEntry,
    addSensoryPass,
  } = useWorkspace();
  const { providers, selectedProvider, selectedModel, selectProvider, apiKeys, setApiKey, setModel, modelSelections } =
    useProviderRegistry();
  const { append: logDebug } = useDebug();

  const [metadata, setMetadata] = useState<StoryMetadata>(activeDraft?.metadata ?? defaultMetadata);
  const [prompt, setPrompt] = useState<string>(activeDraft?.prompt ?? defaultPrompt);
  const [summary, setSummary] = useState<string>(activeDraft?.summary ?? defaultSummary);
  const [tagsInput, setTagsInput] = useState("#Dreamscribe");
  const [isGenerating, setGenerating] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [feedbackFocus, setFeedbackFocus] = useState<"grammar" | "dialogue" | "flow" | "custom">("grammar");
  const [customFeedback, setCustomFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState<"general" | "dialogue" | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setPublishing] = useState(false);
  const [coverVariants, setCoverVariants] = useState<Array<{ id: string; src: string; styleId: string }>>([]);
  const [sensoryPassLoading, setSensoryPassLoading] = useState<SensoryPassType | null>(null);
  const [sensoryPassError, setSensoryPassError] = useState<string | null>(null);
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null);

  const [memorySearch, setMemorySearch] = useState("");
  const [memoryDraftId, setMemoryDraftId] = useState<string | null>(null);
  const [memoryInput, setMemoryInput] = useState("");
  const memoryBaseContent = useRef<string>("");

  const [abWorkingExperiment, setAbWorkingExperiment] = useState<ModelABExperiment | null>(null);
  const [abError, setAbError] = useState<string | null>(null);

  const activeDraftId = activeDraft?.id ?? null;

  useEffect(() => {
    if (!activeDraft) {
      const draft = createDraft({ metadata: defaultMetadata, prompt: defaultPrompt, summary: defaultSummary });
      setMetadata(draft.metadata);
      setPrompt(draft.prompt);
      setSummary(draft.summary);
      return;
    }

    setMetadata(activeDraft.metadata);
    setPrompt(activeDraft.prompt);
    setSummary(activeDraft.summary ?? defaultSummary);
  }, [activeDraft, createDraft]);

  useEffect(() => {
    if (!activeDraftId) return;
    updateDraft(activeDraftId, { metadata });
  }, [metadata, activeDraftId, updateDraft]);
  useEffect(() => {
    setCoverVariants([]);
    setSelectedCoverId(null);
  }, [activeDraftId]);

  useEffect(() => {
    if (!activeDraftId) return;
    updateDraft(activeDraftId, { prompt });
  }, [prompt, activeDraftId, updateDraft]);

  useEffect(() => {
    if (!activeDraftId) return;
    updateDraft(activeDraftId, { summary });
  }, [summary, activeDraftId, updateDraft]);

  useEffect(() => {
    if (!memoryDraftId || !activeDraftId || memoryDraftId !== activeDraftId) return;
    const base = memoryBaseContent.current ?? "";
    const nextContent = memoryInput ? `${base}\n\n${memoryInput}` : base;
    if (activeDraft?.content !== nextContent) {
      updateDraft(activeDraftId, { content: nextContent });
    }
  }, [memoryInput, memoryDraftId, activeDraftId, activeDraft, updateDraft]);

  const activeContent = activeDraft?.content ?? "";
  const activeKey = apiKeys[selectedProvider.id] ?? "";
  const abExperiments = activeDraft?.abExperiments ?? [];
  const experimentsForDisplay = abWorkingExperiment ? [abWorkingExperiment, ...abExperiments] : abExperiments;
  const isAbRunning = Boolean(abWorkingExperiment);
  const continuityEntries = activeDraft?.continuity.entries ?? [];
  const sensoryPasses = activeDraft?.sensoryPasses ?? [];
  const promptRecipesSorted = [...promptRecipes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const providerMap = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const totalExperiments = abExperiments.length;
  const experimentWins = abExperiments.filter((experiment) => experiment.winnerId).length;
  const contentWordCount = activeContent
    ? activeContent
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(Boolean).length
    : 0;
  const lastGeneratedAt = activeDraft?.generatedAt ? new Date(activeDraft.generatedAt) : null;
  const lastFeedback = activeDraft?.feedbackThreads?.[0] ?? null;
  const lastSensoryPass = sensoryPasses[0] ?? null;
  const recentExperiment = experimentsForDisplay[0] ?? null;
  const describeRelativeTime = (date: Date | null) => {
    if (!date) return "—";
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };
  const sceneChecklist = useMemo(
    () => [
      {
        id: "title",
        label: "Title set",
        detail: metadata.title.trim().length ? metadata.title : "Add a working title to stay organised",
        done: Boolean(metadata.title.trim().length),
      },
      {
        id: "summary",
        label: "Summary ready",
        detail: summary.trim().length ? summary.slice(0, 100) + (summary.length > 100 ? "…" : "") : "Write a quick hook for the publish card",
        done: Boolean(summary.trim().length),
      },
      {
        id: "feedback",
        label: "Feedback pass",
        detail: lastFeedback ? `${lastFeedback.focus} · ${describeRelativeTime(new Date(lastFeedback.createdAt))}` : "Request a feedback pass",
        done: Boolean(lastFeedback),
      },
      {
        id: "sensory",
        label: "Sensory polish",
        detail: lastSensoryPass ? `${SENSORY_PASS_CONFIG[lastSensoryPass.kind].label} · ${describeRelativeTime(new Date(lastSensoryPass.createdAt))}` : "Run a sensory pass to enrich detail",
        done: Boolean(lastSensoryPass),
      },
      {
        id: "cover",
        label: "Cover ready",
        detail: coverVariants.length ? `${coverVariants.length} variants generated` : "Generate or upload cover art",
        done: Boolean(coverVariants.length),
      },
      {
        id: "tags",
        label: "Tags added",
        detail: tagsInput.trim().length ? tagsInput : "Add discovery tags",
        done: Boolean(tagsInput.trim().length),
      },
    ],
    [metadata.title, summary, lastFeedback, lastSensoryPass, coverVariants, tagsInput]
  );
  const creativePrompts = useMemo(
    () => {
      const prompts = [] as Array<{ id: string; title: string; body: string }>;
      const tone = metadata.tone.split(",").map((part) => part.trim()).filter(Boolean)[0] || "the current vibe";
      prompts.push({
        id: "character", 
        title: "Character beat",
        body: `Write a single paragraph that shows how your protagonist reacts when the tone turns ${tone.toLowerCase()}.`
      });
      prompts.push({
        id: "setting",
        title: "Setting detail",
        body: `Describe the setting using a sense you've ignored so far (sound, smell, or touch).`
      });
      prompts.push({
        id: "stakes",
        title: "Raise the stakes",
        body: "Add one line that clarifies what your protagonist loses if they fail in this scene."
      });
      if (continuityEntries.length === 0) {
        prompts.push({
          id: "continuity",
          title: "Continuity seed",
          body: "Capture a quick note in the Continuity Coach for the most important character in this draft.",
        });
      } else {
        prompts.push({
          id: "callback",
          title: "Continuity callback",
          body: `Reference ${continuityEntries[0].label} to keep your continuity thread alive.`,
        });
      }
      return prompts;
    },
    [metadata.tone, continuityEntries]
  );
  const recipeTagUsage = useMemo(() => {
    const usage = new Map<string, number>();
    promptRecipes.forEach((recipe) => {
      (recipe.tags ?? []).forEach((tag) => usage.set(tag, (usage.get(tag) ?? 0) + 1));
    });
    return Array.from(usage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [promptRecipes]);
  const continuityByType = useMemo(() => {
    const base: Record<ContinuityEntryType, number> = { character: 0, plot: 0, world: 0 };
    continuityEntries.forEach((entry) => {
      base[entry.type] = (base[entry.type] ?? 0) + 1;
    });
    return base;
  }, [continuityEntries]);

const continuityWarnings = useMemo<ContinuityWarning[]>(() => {
    const text = `${prompt}\n${summary}\n${activeContent}`;
    const textLower = text.toLowerCase();
    const nameMatches = Array.from(text.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g)).map((match) => match[0]);
    const uniqueNames = Array.from(new Set(nameMatches.map((name) => name.trim())));
    const trackedLabels = new Set(continuityEntries.map((entry) => entry.label.toLowerCase()));
    const notices: ContinuityWarning[] = [];

    uniqueNames
      .filter((name) => name.length > 2)
      .filter((name) => {
        const root = name.split(" ")[0];
        return !CONTINUITY_STOP_WORDS.has(root);
      })
      .forEach((name) => {
        if (!trackedLabels.has(name.toLowerCase())) {
          notices.push({
            id: `untracked-${name}`,
            severity: "warn",
            message: `Untracked entity "${name}" detected in your draft.`,
            suggestion: "Add it to keep names, roles, and traits consistent.",
            candidate: { label: name, type: "character" },
          });
        }
      });

    const counts = continuityEntries.reduce<Record<string, number>>((acc, entry) => {
      const key = entry.label.toLowerCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    Object.entries(counts).forEach(([label, count]) => {
      if (count > 1) {
        notices.push({
          id: `duplicate-${label}`,
          severity: "error",
          message: `Multiple continuity entries found for "${label}". Consider merging them.`,
        });
      }
    });

    continuityEntries.forEach((entry) => {
      if (!textLower.includes(entry.label.toLowerCase())) {
        notices.push({
          id: `dormant-${entry.id}`,
          severity: "info",
          message: `"${entry.label}" hasn't appeared in this draft yet.`,
        });
      }
    });

  return notices.slice(0, 8);
}, [continuityEntries, prompt, summary, activeContent]);

  const timelineItems = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string; timestamp: Date; type: "generation" | "experiment" | "feedback" | "sensory" }> = [];
    if (lastGeneratedAt) {
      items.push({
        id: `gen-${activeDraftId ?? "draft"}`,
        title: "Story generated",
        detail: `Model ${selectedProvider.label} · ${selectedModel}`,
        timestamp: lastGeneratedAt,
        type: "generation",
      });
    }
    abExperiments.forEach((experiment) => {
      items.push({
        id: `exp-${experiment.id}`,
        title: experiment.winnerId ? "Comparison winner picked" : "A/B comparison run",
        detail: `${experiment.variants.length} variants · ${experiment.winnerId ? "Winner selected" : "Awaiting vote"}`,
        timestamp: new Date(experiment.createdAt),
        type: "experiment",
      });
    });
    activeDraft?.feedbackThreads?.forEach((thread) => {
      items.push({
        id: `fb-${thread.id}`,
        title: `Feedback: ${thread.focus}`,
        detail: thread.provider,
        timestamp: new Date(thread.createdAt),
        type: "feedback",
      });
    });
    sensoryPasses.forEach((pass) => {
      const config = SENSORY_PASS_CONFIG[pass.kind];
      items.push({
        id: `sensory-${pass.id}`,
        title: `${config.label} pass`,
        detail: config.description,
        timestamp: new Date(pass.createdAt),
        type: "sensory",
      });
    });
    return items
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 12);
  }, [abExperiments, activeDraft?.feedbackThreads, sensoryPasses, lastGeneratedAt, selectedProvider.label, selectedModel, activeDraftId]);

  const matchingMemoryDrafts = useMemo(() => {
    const term = memorySearch.trim().toLowerCase();
    if (!term) return [] as typeof drafts;
    return drafts
      .filter((draft) => draft.metadata.title.toLowerCase().includes(term))
      .slice(0, 5);
  }, [memorySearch, drafts]);

  const isFeedbackCustom = feedbackFocus === "custom";
  const feedbackInstruction = useMemo(() => {
    switch (feedbackFocus) {
      case "grammar":
        return "Provide grammar, spelling, and clarity adjustments. Highlight concrete edits.";
      case "dialogue":
        return "Evaluate dialogue authenticity, subtext, and pacing. Suggest specific line edits.";
      case "flow":
        return "Analyze story structure, pacing, and transitions. Recommend improvements.";
      case "custom":
        return customFeedback || "Offer targeted feedback based on the author's note.";
      default:
        return "";
    }
  }, [feedbackFocus, customFeedback]);

  const handleDownload = () => {
    if (!activeDraft?.content) return;
    const element = document.createElement("a");
    const blob = new Blob([activeDraft.content], { type: "text/plain" });
    element.href = URL.createObjectURL(blob);
    element.download = `${activeDraft.metadata.title || "story"}.txt`;
    element.click();
    URL.revokeObjectURL(element.href);
  };


  const handleCopy = async () => {
    if (!activeDraft?.content) return;
    await navigator.clipboard.writeText(activeDraft.content);
  };

  const addCoverVariant = (src: string, styleId: string) => {
    const entry = { id: generateId("cover"), src, styleId };
    setCoverVariants((prev) => {
      const filtered = prev.filter((variant) => variant.src !== src);
      const next = [...filtered, entry];
      setSelectedCoverId(entry.id);
      return next;
    });
  };

  const handleGenerateCover = (styleId?: string) => {
    try {
      const style = styleId ? (COVER_STYLES.find((item) => item.id === styleId) ?? COVER_STYLES[0]) : COVER_STYLES[0];
      const dataUrl = generateCoverDataUrl(metadata, style);
      addCoverVariant(dataUrl, style.id);
    } catch (error) {
      console.error(error);
      alert("Unable to generate a cover image.");
    }
  };

  const handleGenerateGallery = () => {
    COVER_STYLES.forEach((style) => {
      try {
        const src = generateCoverDataUrl(metadata, style);
        addCoverVariant(src, style.id);
      } catch (error) {
        console.error(error);
      }
    });
  };

  const handleUploadCover = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        addCoverVariant(reader.result, "upload");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCover = (id: string) => {
    setCoverVariants((prev) => {
      const next = prev.filter((variant) => variant.id !== id);
      if (next.length === 0) {
        setSelectedCoverId(null);
      } else if (!next.some((variant) => variant.id === selectedCoverId)) {
        setSelectedCoverId(next[next.length - 1].id);
      }
      return next;
    });
  };

  const assignModelFromRecipe = (recipe: PromptRecipe) => {
    if (!recipe.bestModel) return;
    const targetModel = recipe.bestModel.trim();
    if (!targetModel) return;
    const providerMatch = providers.find((provider) => provider.models.includes(targetModel));
    if (providerMatch) {
      selectProvider(providerMatch.id);
      setModel(providerMatch.id, targetModel);
    } else {
      setModel(selectedProvider.id, targetModel);
    }
  };

  const handleSaveRecipe = (input: PromptRecipeInput) => {
    const recipe = createPromptRecipe(input);
    logDebug({
      level: "info",
      summary: `Saved prompt recipe "${recipe.title}"`,
      payload: { recipeId: recipe.id, tags: recipe.tags },
    });
  };

  const handleApplyRecipe = (recipe: PromptRecipe) => {
    setPrompt(recipe.prompt);
    if (recipe.toneNotes) {
      setMetadata((prev) => ({ ...prev, tone: recipe.toneNotes ?? prev.tone }));
    }
    assignModelFromRecipe(recipe);
    logDebug({
      level: "request",
      summary: `Applied prompt recipe "${recipe.title}"`,
      payload: { recipeId: recipe.id },
    });
  };

  const handleRemixRecipe = (recipe: PromptRecipe) => {
    const directives = [
      recipe.toneNotes ? `Dial the tone toward ${recipe.toneNotes}.` : null,
      recipe.pacingNotes ? `Respect pacing guidance: ${recipe.pacingNotes}.` : null,
      "Offer two variant hooks and commit to the strongest before drafting.",
    ]
      .filter(Boolean)
      .map((line) => `- ${line}`)
      .join("\n");
    const remix = `${recipe.prompt.trim()}\n\nRemix directives:\n${directives}`;
    setPrompt(remix);
    if (recipe.toneNotes) {
      setMetadata((prev) => ({ ...prev, tone: recipe.toneNotes || prev.tone }));
    }
    assignModelFromRecipe(recipe);
    logDebug({
      level: "info",
      summary: `Remixed prompt recipe "${recipe.title}"`,
      payload: { recipeId: recipe.id },
    });
  };

  const handleDeleteRecipe = (recipeId: string) => {
    deletePromptRecipe(recipeId);
    logDebug({ level: "info", summary: "Deleted prompt recipe", payload: { recipeId } });
  };

  const handleShareRecipe = async (recipe: PromptRecipe) => {
    const bundle = {
      schema: "dreamscribe/prompt-recipe@1",
      exportedAt: new Date().toISOString(),
      recipe: {
        title: recipe.title,
        prompt: recipe.prompt,
        toneNotes: recipe.toneNotes,
        pacingNotes: recipe.pacingNotes,
        bestModel: recipe.bestModel,
        tags: recipe.tags,
        updatedAt: recipe.updatedAt,
      },
      context: {
        storyTitle: metadata.title,
        genre: metadata.genre,
        perspective: metadata.perspective,
        targetLength: metadata.targetLength,
      },
    };
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      throw new Error("Clipboard access is not available in this environment.");
    }
    await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    logDebug({
      level: "response",
      summary: `Copied prompt recipe "${recipe.title}" bundle`,
      payload: { recipeId: recipe.id },
    });
  };

  const handleContinuityCreate = (input: ContinuityEntryInput) => {
    if (!activeDraftId) return;
    const entry = addContinuityEntry(activeDraftId, input);
    logDebug({
      level: "info",
      summary: "Continuity entry added",
      payload: { entryId: entry.id, type: entry.type },
    });
  };

  const handleContinuityUpdate = (entryId: string, patch: ContinuityEntryInput) => {
    if (!activeDraftId) return;
    updateContinuityEntry(activeDraftId, entryId, patch);
    logDebug({
      level: "info",
      summary: "Continuity entry updated",
      payload: { entryId, type: patch.type ?? continuityEntries.find((entry) => entry.id === entryId)?.type },
    });
  };

  const handleContinuityDelete = (entryId: string) => {
    if (!activeDraftId) return;
    deleteContinuityEntry(activeDraftId, entryId);
    logDebug({ level: "info", summary: "Continuity entry removed", payload: { entryId } });
  };

  const handleContinuityQuickAdd = (candidate: { label: string; type: ContinuityEntryType }) => {
    if (!activeDraftId) return;
    const entry = addContinuityEntry(activeDraftId, {
      type: candidate.type,
      label: candidate.label,
      summary: "",
      traits: [],
    });
    logDebug({
      level: "info",
      summary: "Continuity entry quick-added",
      payload: { entryId: entry.id, label: candidate.label },
    });
  };

  const handleSensoryPass = async (kind: SensoryPassType) => {
    if (!activeDraft || !ensureKey()) return;
    if (!activeDraft.content.trim()) {
      setSensoryPassError("Generate story content before running a stylistic pass.");
      return;
    }
    const config = SENSORY_PASS_CONFIG[kind];
    setSensoryPassError(null);
    setSensoryPassLoading(kind);

    const request = {
      provider: selectedProvider,
      apiKey: activeKey,
      metadata,
      draft: activeDraft.content,
      focus: "custom" as const,
      instruction: config.instruction,
      model: selectedModel,
    };

    logDebug({
      level: "request",
      summary: `${config.label} pass`,
      payload: { provider: selectedProvider.id, model: selectedModel, kind },
    });

    try {
      const response = await requestFeedback(request);
      const pass: SensoryPass = {
        id: generateId("pass"),
        kind,
        createdAt: new Date().toISOString(),
        response: response.content,
      };
      addSensoryPass(activeDraft.id, pass);
      logDebug({
        level: "response",
        summary: `${config.label} pass ready`,
        payload: { passId: pass.id, kind },
      });
    } catch (error) {
      const message = resolveErrorMessage(error, `${config.label} pass failed`);
      setSensoryPassError(message);
      const details =
        error instanceof AIClientError ? { status: error.status, payload: error.payload } : { error: String(error) };
      logDebug({
        level: "error",
        summary: message,
        payload: { provider: selectedProvider.id, kind, ...details },
      });
    } finally {
      setSensoryPassLoading(null);
    }
  };

  const handleCopySensoryPass = async (pass: SensoryPass) => {
    await navigator.clipboard.writeText(pass.response);
  };

  const handleAdoptSensoryPass = (pass: SensoryPass) => {
    if (!activeDraftId || !activeDraft) return;
    const label = SENSORY_PASS_CONFIG[pass.kind].label;
    const note = `\n\n[${label} pass]\n${pass.response.trim()}`;
    updateDraft(activeDraftId, { content: `${activeDraft.content}${note}` });
    logDebug({
      level: "info",
      summary: "Sensory pass appended to draft",
      payload: { passId: pass.id, kind: pass.kind },
    });
  };

  const handleRunABExperiment = async (selection: Array<{ providerId: ProviderId; model: string }>) => {
    if (!activeDraft) {
      setAbError("Create or select a draft before running a comparison.");
      return;
    }
    const resolved = selection
      .map((item) => {
        const provider = providers.find((p) => p.id === item.providerId);
        if (!provider) return null;
        const model = provider.models.includes(item.model) ? item.model : provider.defaultModel;
        return { provider, model };
      })
      .filter(Boolean) as Array<{ provider: ProviderDescriptor; model: string }>;

    if (resolved.length < 2) {
      setAbError("Select at least two supported providers to compare.");
      return;
    }

    const missingKey = resolved.find(({ provider }) => !apiKeys[provider.id]?.trim());
    if (missingKey) {
      setAbError(`Add an API key for ${missingKey.provider.label} before running the comparison.`);
      return;
    }

    const tokensEstimate = tokensFor(metadata);
    const timestamp = new Date().toISOString();
    const experimentId = generateId("ab");
    const variants: ModelVariantResult[] = resolved.map(({ provider, model }) => ({
      id: generateId("variant"),
      providerId: provider.id,
      providerLabel: provider.label,
      model,
      status: "pending",
      costEstimate: estimateGenerationCost(provider.id, tokensEstimate),
      estimatedTokens: tokensEstimate,
      createdAt: timestamp,
    }));

    const experiment: ModelABExperiment = {
      id: experimentId,
      createdAt: timestamp,
      prompt,
      summary,
      variants,
      winnerId: null,
    };

    setAbError(null);
    setAbWorkingExperiment(experiment);

    const mutableVariants = variants.map((variant) => ({ ...variant }));

    await Promise.all(
      mutableVariants.map(async (variant) => {
        const providerEntry = resolved.find(({ provider }) => provider.id === variant.providerId);
        if (!providerEntry) return;
        const { provider, model } = providerEntry;
        const apiKey = apiKeys[provider.id] ?? "";
        const request = {
          provider,
          apiKey,
          metadata,
          prompt,
          temperature: 0.72,
          maxTokens: tokensEstimate,
          model,
        } as const;
        const started = performance.now();
        logDebug({
          level: "request",
          summary: `A/B request - ${provider.label}`,
          payload: { provider: provider.id, model, tokensEstimate },
        });
        try {
          const response = await generateStory(request);
          Object.assign(variant, {
            status: "success" as const,
            content: response.content,
            tokensUsed: response.tokensUsed,
            durationMs: performance.now() - started,
          });
          logDebug({
            level: "response",
            summary: `A/B result - ${provider.label}`,
            payload: { provider: provider.id, model, tokensUsed: response.tokensUsed },
          });
        } catch (error) {
          const message = resolveErrorMessage(error, `Failed to generate with ${provider.label}`);
          Object.assign(variant, { status: "error" as const, error: message });
          const details =
            error instanceof AIClientError ? { status: error.status, payload: error.payload } : { error: String(error) };
          logDebug({ level: "error", summary: message, payload: { provider: provider.id, model, ...details } });
        } finally {
          setAbWorkingExperiment((prev) =>
            prev && prev.id === experimentId
              ? { ...prev, variants: prev.variants.map((item) => (item.id === variant.id ? { ...variant } : item)) }
              : prev
          );
        }
      })
    );

    const finishedExperiment: ModelABExperiment = {
      ...experiment,
      variants: mutableVariants,
      winnerId: experiment.winnerId ?? null,
    };
    setAbWorkingExperiment(null);
    const existingExperiments = activeDraft.abExperiments ?? [];
    updateDraft(activeDraft.id, { abExperiments: [finishedExperiment, ...existingExperiments] });
    logDebug({
      level: "info",
      summary: "Completed model comparison",
      payload: { experimentId, variants: mutableVariants.map((variant) => ({ provider: variant.providerId, status: variant.status })) },
    });
  };

  const handleMarkWinner = (experimentId: string, variantId: string) => {
    if (abWorkingExperiment && abWorkingExperiment.id === experimentId) {
      setAbWorkingExperiment({ ...abWorkingExperiment, winnerId: variantId });
      return;
    }
    if (!activeDraftId) return;
    const currentExperiments = activeDraft?.abExperiments ?? [];
    const next = currentExperiments.map((experiment) =>
      experiment.id === experimentId ? { ...experiment, winnerId: variantId } : experiment
    );
    updateDraft(activeDraftId, { abExperiments: next });
    logDebug({ level: "info", summary: "Marked A/B winner", payload: { experimentId, variantId } });
  };

  const handleAdoptVariant = (experimentId: string, variantId: string) => {
    const sourceExperiment =
      abWorkingExperiment && abWorkingExperiment.id === experimentId
        ? abWorkingExperiment
        : (activeDraft?.abExperiments ?? []).find((experiment) => experiment.id === experimentId) ?? null;
    const variant = sourceExperiment?.variants.find((entry) => entry.id === variantId);
    if (!variant || variant.status !== "success" || !variant.content || !activeDraftId) {
      return;
    }
    updateDraft(activeDraftId, { content: variant.content, generatedAt: new Date().toISOString() });
    logDebug({
      level: "info",
      summary: "Adopted A/B variant output",
      payload: { experimentId, variantId, provider: variant.providerId },
    });
  };


  const ensureKey = () => {
    if (!activeKey) {
      logDebug({ level: "error", summary: "Missing API key", payload: { provider: selectedProvider.id } });
      alert("Please enter an API key for the selected provider before continuing.");
      return false;
    }
    return true;
  };

  const handleSelectMemoryDraft = (draftId: string) => {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return;
    setMemoryDraftId(draftId);
    memoryBaseContent.current = draft.content;
    setMemoryInput("");
    selectDraft(draftId);
  };

  const handleCloseMemory = () => {
    setMemoryDraftId(null);
    setMemoryInput("");
    memoryBaseContent.current = "";
  };

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeDraft || !ensureKey()) return;

    setStoryError(null);
    setGenerating(true);

    const request = {
      provider: selectedProvider,
      apiKey: activeKey,
      metadata,
      prompt,
      temperature: 0.72,
      maxTokens: tokensFor(metadata),
      model: selectedModel,
    } as const;

    logDebug({
      level: "request",
      summary: `Story request - ${selectedProvider.label}`,
      payload: {
        provider: selectedProvider.id,
        model: selectedModel,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        promptLength: prompt.length,
      },
    });

    try {
      const response = await generateStory(request);
      updateDraft(activeDraft.id, { content: response.content, generatedAt: new Date().toISOString() });
      logDebug({
        level: "response",
        summary: "Story generated",
        payload: {
          provider: selectedProvider.id,
          model: selectedModel,
          tokensUsed: response.tokensUsed,
        },
      });
    } catch (error) {
      const message = resolveErrorMessage(error, "Failed to generate story");
      setStoryError(message);
      const details = error instanceof AIClientError ? { status: error.status, payload: error.payload } : { error: String(error) };
      logDebug({ level: "error", summary: message, payload: { provider: selectedProvider.id, ...details } });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!activeDraft) {
      setPublishError("Create or select a draft before publishing.");
      return;
    }
    if (!activeDraft.content.trim()) {
      setPublishError("Generate or enter story content first.");
      return;
    }
    if (!summary.trim()) {
      setPublishError("Add a short summary so readers know what to expect.");
      return;
    }
    if (!user) {
      navigate("/login", { replace: true, state: { from: { pathname: "/studio" } } });
      return;
    }

    try {
      setPublishing(true);
      setPublishError(null);
      const tags = parseTags(tagsInput);
      const gallery = coverVariants.map((variant) => variant.src);
      const selectedVariant = coverVariants.find((variant) => variant.id === selectedCoverId) ?? coverVariants[0];
      const story = publishStory({
        authorId: user.id,
        authorName: user.displayName,
        metadata,
        content: activeDraft.content,
        summary: summary.trim(),
        tags,
        coverImage: selectedVariant?.src,
        coverGallery: gallery,
        coverStyle: selectedVariant?.styleId,
      });
      recordStoryPublished(story);
      logDebug({
        level: "info",
        summary: "Story published",
        payload: { storyId: story.id, hasCover: Boolean(selectedVariant?.src) },
      });
      navigate(`/stories/${story.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to publish";
      setPublishError(msg);
    } finally {
      setPublishing(false);
    }
  };

  const runFeedback = async (options: { focus: "grammar" | "dialogue" | "flow" | "custom"; instruction: string; loadingKey: "general" | "dialogue" }) => {
    if (!activeDraft || !ensureKey()) return;
    if (!activeDraft.content) {
      setFeedbackError("Generate a story before requesting feedback.");
      return;
    }

    setFeedbackError(null);
    setFeedbackLoading(options.loadingKey);

    const request = {
      provider: selectedProvider,
      apiKey: activeKey,
      metadata,
      draft: activeDraft.content,
      focus: options.focus,
      instruction: options.instruction,
      model: selectedModel,
    } as const;

    logDebug({
      level: "request",
      summary: `Feedback request (${options.focus})`,
      payload: {
        provider: selectedProvider.id,
        model: selectedModel,
        focus: options.focus,
        instructionLength: options.instruction.length,
      },
    });

    try {
      const response = await requestFeedback(request);
      const feedback = addFeedback(activeDraft.id, {
        provider: `${selectedProvider.label} - ${selectedModel}`,
        focus: options.focus,
        request: options.instruction,
        response: response.content,
      });
      logDebug({
        level: "response",
        summary: `Feedback received (${options.focus})`,
        payload: {
          provider: selectedProvider.id,
          model: selectedModel,
          feedbackId: feedback.id,
        },
      });
    } catch (error) {
      const message = resolveErrorMessage(error, "Feedback request failed");
      setFeedbackError(message);
      const details = error instanceof AIClientError ? { status: error.status, payload: error.payload } : { error: String(error) };
      logDebug({ level: "error", summary: message, payload: { provider: selectedProvider.id, ...details } });
    } finally {
      setFeedbackLoading(null);
    }
  };

  const handleFeedbackClick = () => {
    runFeedback({ focus: feedbackFocus, instruction: feedbackInstruction, loadingKey: "general" });
  };

  const handleDialogueEnhance = () => {
    runFeedback({
      focus: "dialogue",
      instruction:
        "Review the draft's dialogue. Tighten pacing, infuse subtext, and ensure each character's voice is distinct. Provide revised line suggestions.",
      loadingKey: "dialogue",
    });
  };

  

  return (
    <form className="studio-shell" onSubmit={handleGenerate}>
      <section className="studio-sidebar">
        <div className="studio-panel">
          <header className="studio-panel__header">
            <div>
              <h3>AI provider</h3>
              <p>Select which model will lead your next draft.</p>
            </div>
          </header>
          <div className="studio-provider-list">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => selectProvider(provider.id)}
                className={provider.id === selectedProvider.id ? "provider-option provider-option--active" : "provider-option"}
              >
                <span>{provider.label}</span>
                <small>{provider.defaultModel}</small>
              </button>
            ))}
          </div>
          <div className="studio-provider-credentials">
            <label className="studio-provider-key">
              <span>API key</span>
              <input
                type="password"
                value={activeKey}
                onChange={(event) => setApiKey(selectedProvider.id, event.target.value)}
                placeholder="Paste your secret key"
              />
              <small>
                Keys stay in your browser. Read provider docs{" "}
                {selectedProvider.docsUrl && (
                  <a
                    href={selectedProvider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open provider documentation"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
              </small>
            </label>
            {selectedProvider.models.length > 0 && (
              <label className="studio-provider-model">
                <span>Model</span>
                <select value={selectedModel} onChange={(event) => setModel(selectedProvider.id, event.target.value)}>
                  {selectedProvider.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <small>Switch models if your account lacks access to the default.</small>
              </label>
            )}
          </div>
        </div>
        <StoryMetadataForm metadata={metadata} onChange={setMetadata} />
        <PromptPalettePanel
          currentPrompt={prompt}
          metadata={metadata}
          selectedModel={selectedModel}
          recipes={promptRecipes}
          onSaveRecipe={handleSaveRecipe}
          onApplyRecipe={handleApplyRecipe}
          onRemixRecipe={handleRemixRecipe}
          onDeleteRecipe={handleDeleteRecipe}
          onShareRecipe={handleShareRecipe}
        />
        <ContinuityCoachPanel
          entries={continuityEntries}
          warnings={continuityWarnings}
          onCreate={handleContinuityCreate}
          onUpdate={handleContinuityUpdate}
          onDelete={handleContinuityDelete}
          onQuickAdd={handleContinuityQuickAdd}
        />
        <div className="studio-panel">
          <header className="studio-panel__header">
            <div>
              <h3>Draft analytics</h3>
              <p>Monitor generation costs and word counts at a glance.</p>
            </div>
          </header>
          <div className="insight-grid">
            <article>
              <span className="insight-label">Current tokens</span>
              <strong>{tokensFor(metadata)}</strong>
              <small>Target budget based on story length</small>
            </article>
            <article>
              <span className="insight-label">Word count</span>
              <strong>{contentWordCount.toLocaleString()}</strong>
              <small>{contentWordCount > 0 ? `${Math.round(contentWordCount / Math.max(tokensFor(metadata) / 4, 1) * 100)}% of plan` : "Draft not generated yet"}</small>
            </article>
            <article>
              <span className="insight-label">Experiments</span>
              <strong>{totalExperiments}</strong>
              <small>{experimentWins} recorded winners</small>
            </article>
          </div>
          <div className="cost-table">
            <header>
              <span>Provider</span>
              <span>Model</span>
              <span>Est. cost</span>
            </header>
            {providers.map((provider) => {
              const model = modelSelections[provider.id] ?? provider.defaultModel;
              const cost = estimateGenerationCost(provider.id, tokensFor(metadata));
              return (
                <div key={provider.id}>
                  <span>{provider.label}</span>
                  <span>{model}</span>
                  <span>${cost.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="studio-panel">
          <header className="studio-panel__header">
            <div>
              <h3>Provider health check</h3>
              <p>Ensure your keys and models are ready before you generate.</p>
            </div>
          </header>
          <ul className="panel-list">
            {providers.map((provider) => {
              const hasKey = Boolean(apiKeys[provider.id]);
              const currentModel = modelSelections[provider.id] ?? provider.defaultModel;
              const notes = provider.models.includes(currentModel)
                ? "Model available"
                : "Model not in preset list";
              return (
                <li key={provider.id}>
                  <div>
                    <strong>{provider.label}</strong>
                    <small>{hasKey ? "Key stored" : "Key missing"}</small>
                  </div>
                  <p>{notes}</p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="studio-panel">
          <header className="studio-panel__header">
            <div>
              <h3>Draft checkpoints</h3>
              <p>Upcoming steps to keep your workflow moving forward.</p>
            </div>
          </header>
          <ul className="panel-list">
            <li>
              <strong>Run a fresh comparison</strong>
              <p>Pick a new pair of models to see how they adapt to your latest edits.</p>
            </li>
            <li>
              <strong>Request feedback</strong>
              <p>Pull a flow or dialogue pass to stress-test pacing and voice.</p>
            </li>
            <li>
              <strong>Update prompt palette</strong>
              <p>Add the current setup to your palette so you can reuse it on future chapters.</p>
            </li>
          </ul>
        </div>
        <div className="studio-panel">
          <header className="studio-panel__header">
            <div>
              <h3>Collaboration notes</h3>
              <p>Jot reminders for co-authors or future edits.</p>
            </div>
          </header>
          <textarea
            className="studio-textarea"
            rows={6}
            placeholder="Future edit ideas, co-author notes, open questions…"
            value={activeDraft?.summary ?? ""}
            onChange={(event) => setSummary(event.target.value)}
          />
          <p className="studio-output__placeholder">Notes save with your draft so you can revisit them later.</p>
        </div>
      </section>

      <section className="studio-main">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <ModelABExplorerPanel
            metadata={metadata}
            providers={providers}
            modelSelections={modelSelections}
            apiKeys={apiKeys}
            selectedProviderId={selectedProvider.id}
            selectedModel={selectedModel}
            experiments={abExperiments}
            workingExperiment={abWorkingExperiment}
            onRun={handleRunABExperiment}
            onMarkWinner={handleMarkWinner}
            onAdopt={handleAdoptVariant}
            error={abError}
            isRunning={isAbRunning}
          />
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Story prompt</h3>
              <p>Explain the scene, stakes, and stylistic anchors for the AI writers.</p>
            </div>
            <button type="submit" className="primary-button" disabled={isGenerating}>
              <Wand2 size={18} /> {isGenerating ? "Working..." : "Generate story"}
            </button>
          </header>
          <textarea
            className="studio-textarea"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the story you want to tell..."
            rows={10}
          />
          {storyError && <div className="notice notice--error">{storyError}</div>}
        </motion.div>

        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Feedback passes</h3>
              <p>Invite a model to critique and refine the current draft.</p>
            </div>
          </header>
          <div className="studio-feedback-controls">
            <div className="chip-group">
              {(["grammar", "dialogue", "flow", "custom"] as const).map((focus) => (
                <button
                  key={focus}
                  type="button"
                  className={feedbackFocus === focus ? "chip chip--active" : "chip"}
                  onClick={() => setFeedbackFocus(focus)}
                >
                  {focus === "custom" ? "Custom" : focus.charAt(0).toUpperCase() + focus.slice(1)}
                </button>
              ))}
            </div>
            {isFeedbackCustom && (
              <textarea
                className="studio-textarea"
                rows={3}
                value={customFeedback}
                onChange={(event) => setCustomFeedback(event.target.value)}
                placeholder="Describe the feedback you want (e.g., tighten the ending, amplify tension)."
              />
            )}
            <div className="studio-feedback-actions">
              <button type="button" className="ghost-button" disabled={feedbackLoading !== null} onClick={handleFeedbackClick}>
                <MessageSquare size={16} />
                {feedbackLoading === "general" ? "Analysing..." : "Request feedback"}
              </button>
              <button type="button" className="ghost-button" disabled={feedbackLoading !== null} onClick={handleDialogueEnhance}>
                <AlignLeft size={16} />
                {feedbackLoading === "dialogue" ? "Polishing..." : "Improve dialogue"}
              </button>
            </div>
            <p className="studio-feedback-note">Focus: {feedbackInstruction}</p>
            {feedbackError && <div className="notice notice--error">{feedbackError}</div>}
          </div>
        </motion.div>

        <motion.div className="studio-panel studio-panel--tall" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Story output</h3>
              <p>See generations and apply revisions inline.</p>
            </div>
            <div className="studio-output-actions">
              <button type="button" className="ghost-button" onClick={handleCopy} disabled={!activeContent}>
                <Copy size={16} /> Copy
              </button>
              <button type="button" className="ghost-button" onClick={handleDownload} disabled={!activeContent}>
                <Download size={16} /> Download
              </button>
            </div>
          </header>
          <div className="studio-output">
            {isGenerating ? (
              <Skeleton lines={10} />
            ) : activeContent ? (
              <article>
                <h2>{activeDraft?.metadata.title}</h2>
                <pre>{activeContent}</pre>
              </article>
            ) : (
              <p className="studio-output__placeholder">Your story will appear here once you generate a draft.</p>
            )}
          </div>
        </motion.div>

        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Feedback threads</h3>
              <p>Track critiques and revision suggestions from your AI editors.</p>
            </div>
          </header>
          {activeDraft?.feedbackThreads?.length ? (
            <div className="feedback-thread-list">
              {activeDraft.feedbackThreads.map((thread) => (
                <article key={thread.id} className="feedback-thread">
                  <header>
                    <span className="feedback-thread__provider">
                      <Sparkles size={14} /> {thread.provider}
                    </span>
                    <time>{new Date(thread.createdAt).toLocaleTimeString()}</time>
                  </header>
                  <p className="feedback-thread__focus">Focus: {thread.focus.charAt(0).toUpperCase() + thread.focus.slice(1)}</p>
                  <pre>{thread.response}</pre>
                </article>
              ))}
            </div>
          ) : (
            <p className="studio-output__placeholder">Request feedback to see critiques and action items here.</p>
          )}
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Sensory passes</h3>
              <p>One-click style passes that keep your original draft intact.</p>
            </div>
            {sensoryPassLoading && <Loader2 className="spin" size={16} />}
          </header>
          <div className="sensory-pass-actions">
            {(Object.keys(SENSORY_PASS_CONFIG) as SensoryPassType[]).map((kind) => {
              const config = SENSORY_PASS_CONFIG[kind];
              const isLoading = sensoryPassLoading === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  className="ghost-button"
                  disabled={isLoading || isGenerating}
                  onClick={() => handleSensoryPass(kind)}
                >
                  {isLoading ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />} {config.label}
                </button>
              );
            })}
          </div>
          <p className="sensory-pass-hint">Pick a pass to inject focused improvements without overwriting the existing prose.</p>
          {sensoryPassError && <div className="notice notice--error">{sensoryPassError}</div>}
          <div className="sensory-pass-list">
            {sensoryPasses.length === 0 ? (
              <p className="studio-output__placeholder">Run a pass to see targeted revisions here.</p>
            ) : (
              sensoryPasses.map((pass) => {
                const config = SENSORY_PASS_CONFIG[pass.kind];
                return (
                  <article key={pass.id} className="sensory-pass-card">
                    <header>
                      <div>
                        <strong>{config.label}</strong>
                        <small>{config.description}</small>
                      </div>
                      <time>{new Date(pass.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                    </header>
                    <pre className="sensory-pass-card__body">{pass.response}</pre>
                    <div className="sensory-pass-card__actions">
                      <button type="button" className="ghost-button" onClick={() => handleCopySensoryPass(pass)}>
                        <Copy size={14} /> Copy
                      </button>
                      <button type="button" className="ghost-button" onClick={() => handleAdoptSensoryPass(pass)}>
                        <Sparkles size={14} /> Append
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Studio insights</h3>
              <p>Snapshot of this draft's momentum and recent activity.</p>
            </div>
          </header>
          <div className="insight-grid">
            <article>
              <span className="insight-label">Words in draft</span>
              <strong>{contentWordCount.toLocaleString()}</strong>
            </article>
            <article>
              <span className="insight-label">Experiments</span>
              <strong>{totalExperiments}</strong>
              <small>{experimentWins} marked as winners</small>
            </article>
            <article>
              <span className="insight-label">Feedback threads</span>
              <strong>{activeDraft?.feedbackThreads?.length ?? 0}</strong>
              <small>{lastFeedback ? describeRelativeTime(new Date(lastFeedback.createdAt)) : "No feedback yet"}</small>
            </article>
            <article>
              <span className="insight-label">Sensory passes</span>
              <strong>{sensoryPasses.length}</strong>
              <small>{lastSensoryPass ? describeRelativeTime(new Date(lastSensoryPass.createdAt)) : "No passes run"}</small>
            </article>
            <article>
              <span className="insight-label">Last generation</span>
              <strong>{lastGeneratedAt ? describeRelativeTime(lastGeneratedAt) : "Not yet generated"}</strong>
              <small>Token budget ≈ {tokensFor(metadata)}</small>
            </article>
          </div>
          {recentExperiment && (
            <section className="insight-detail">
              <header>
                <h4>Latest comparison</h4>
                <span>{describeRelativeTime(new Date(recentExperiment.createdAt))}</span>
              </header>
              <ul>
                {recentExperiment.variants.map((variant) => (
                  <li key={variant.id}>
                    <strong>{variant.providerLabel}</strong> · {variant.model}
                    <small>
                      {variant.status === "success"
                        ? `${variant.tokensUsed ?? variant.estimatedTokens} tokens`
                        : variant.status === "error"
                        ? variant.error ?? "Failed"
                        : "Pending"}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Activity timeline</h3>
              <p>Track the latest comparisons, feedback, and sensory tweaks.</p>
            </div>
          </header>
          <div className="timeline-list">
            {timelineItems.length === 0 ? (
              <p className="studio-output__placeholder">Run a comparison, request feedback, or trigger a sensory pass to see activity here.</p>
            ) : (
              timelineItems.map((item) => (
                <article key={item.id} className={`timeline-item timeline-item--${item.type}`}>
                  <div className="timeline-item__meta">
                    <span className="timeline-item__title">{item.title}</span>
                    <time>{describeRelativeTime(item.timestamp)}</time>
                  </div>
                  <p>{item.detail}</p>
                </article>
              ))
            )}
          </div>
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Prompt palette overview</h3>
              <p>Resurface your favourite recipes and see trending tags.</p>
            </div>
          </header>
          {promptRecipesSorted.length === 0 ? (
            <p className="studio-output__placeholder">Save a prompt to start building your palette.</p>
          ) : (
            <>
              <div className="insight-grid">
                <article>
                  <span className="insight-label">Recipes saved</span>
                  <strong>{promptRecipesSorted.length}</strong>
                </article>
                <article>
                  <span className="insight-label">Top tag</span>
                  {recipeTagUsage.length ? (
                    <strong>{recipeTagUsage[0][0]}</strong>
                  ) : (
                    <strong>—</strong>
                  )}
                  <small>{recipeTagUsage.length ? `${recipeTagUsage[0][1]} uses` : "Tag recipes to keep them organised"}</small>
                </article>
              </div>
              {recipeTagUsage.length > 0 && (
                <div className="tag-cloud">
                  {recipeTagUsage.map(([tag, count]) => (
                    <span key={tag} className="tag-chip">
                      {tag} · {count}
                    </span>
                  ))}
                </div>
              )}
              <ul className="panel-list">
                {promptRecipesSorted.slice(0, 4).map((recipe) => (
                  <li key={recipe.id}>
                    <div>
                      <strong>{recipe.title}</strong>
                      <small>{describeRelativeTime(new Date(recipe.updatedAt))}</small>
                    </div>
                    <p>{recipe.toneNotes || recipe.prompt.slice(0, 120)}{recipe.prompt.length > 120 ? "…" : ""}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Continuity snapshot</h3>
              <p>Keep track of characters, plot threads, and world rules.</p>
            </div>
          </header>
          <div className="insight-grid">
            <article>
              <span className="insight-label">Characters</span>
              <strong>{continuityByType.character}</strong>
            </article>
            <article>
              <span className="insight-label">Plot threads</span>
              <strong>{continuityByType.plot}</strong>
            </article>
            <article>
              <span className="insight-label">World facts</span>
              <strong>{continuityByType.world}</strong>
            </article>
            <article>
              <span className="insight-label">Warnings</span>
              <strong>{continuityWarnings.length}</strong>
              <small>{continuityWarnings.length ? "Resolve continuity gaps" : "All clear"}</small>
            </article>
          </div>
          <ul className="panel-list">
            {continuityEntries.slice(0, 4).map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.label}</strong>
                  <small>{entry.type}</small>
                </div>
                <p>{entry.summary || "No summary yet."}</p>
              </li>
            ))}
            {continuityEntries.length === 0 && (
              <li>
                <p className="studio-output__placeholder">Capture key characters and world notes in the Continuity Coach sidebar.</p>
              </li>
            )}
          </ul>
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Generation playbook</h3>
              <p>Quick reminders to keep drafts sharp and consistent.</p>
            </div>
          </header>
          <ul className="panel-list">
            <li>
              <strong>Cross-check POV</strong>
              <p>Ensure the prompt, continuity notes, and latest generation share the same perspective to avoid voice drift.</p>
            </li>
            <li>
              <strong>Compare models after major edits</strong>
              <p>Run an A/B pass on the current paragraph to see which provider keeps tone and pacing closest to your intent.</p>
            </li>
            <li>
              <strong>Layer sensory passes sparingly</strong>
              <p>Append the suggested rewrite, then blend it with your draft instead of replacing everything wholesale.</p>
            </li>
            <li>
              <strong>Refresh prompt palette tags</strong>
              <p>Group related recipes with matching tags so you can stack experiments quickly for each genre.</p>
            </li>
          </ul>
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.64 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Workspace shortcuts</h3>
              <p>Speed through the studio with these handy keys.</p>
            </div>
          </header>
          <ul className="shortcut-list">
            <li><kbd>Alt</kbd> + <kbd>D</kbd> – Toggle debug console</li>
            <li><kbd>Ctrl</kbd> + <kbd>Enter</kbd> – Run story generation</li>
            <li><kbd>Shift</kbd> + <kbd>Enter</kbd> – Request feedback</li>
            <li><kbd>Ctrl</kbd> + <kbd>S</kbd> – Save prompt recipe</li>
            <li><kbd>Ctrl</kbd> + <kbd>L</kbd> – Focus story library search</li>
          </ul>
          <p className="studio-output__placeholder">Customize shortcuts in Settings → Keyboard if you need a different layout.</p>
        </motion.div>
        <motion.div className="studio-panel memory-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Story memory</h3>
              <p>Search earlier drafts and continue them in real time.</p>
            </div>
          </header>
          <label>
            <span>Search by title</span>
            <input
              type="text"
              value={memorySearch}
              onChange={(event) => setMemorySearch(event.target.value)}
              placeholder="e.g., Bob's Job"
            />
          </label>
          {memorySearch.trim() ? (
            matchingMemoryDrafts.length ? (
              <ul className="memory-result-list">
                {matchingMemoryDrafts.map((draft) => (
                  <li key={draft.id}>
                    <div>
                      <strong>{draft.metadata.title}</strong>
                      <span>
                        {draft.summary ? draft.summary : draft.metadata.genre}
                      </span>
                    </div>
                    <button type="button" className="ghost-button" onClick={() => handleSelectMemoryDraft(draft.id)}>
                      Continue
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="memory-hint">No drafts matched that title.</p>
            )
          ) : (
            <p className="memory-hint">Type a title to locate earlier drafts.</p>
          )}
          {memoryDraftId && activeDraftId === memoryDraftId && (
            <div className="memory-editor">
              <header>
                <h4>Continuing "{activeDraft?.metadata.title}"</h4>
                <button type="button" className="ghost-button" onClick={handleCloseMemory}>
                  Done
                </button>
              </header>
              <textarea
                value={memoryInput}
                onChange={(event) => setMemoryInput(event.target.value)}
                rows={4}
                placeholder="Add new beats or revisions — updates apply live."
              />
            </div>
          )}
        </motion.div>
        <motion.div className="studio-panel publish-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.76 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Publish & share</h3>
              <p>Summarize your story, tag it, and make it discoverable.</p>
            </div>
          </header>
          <div className="cover-builder">
            <div className="cover-builder__header">
              <span>Cover gallery (optional)</span>
              <button type="button" className="ghost-button" onClick={handleGenerateGallery}>Generate set</button>
            </div>
            <div className="cover-style-chip-row">
              {COVER_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  className="cover-style-chip"
                  onClick={() => handleGenerateCover(style.id)}
                >
                  {style.label}
                </button>
              ))}
            </div>
            {coverVariants.length ? (
              <div className="cover-variant-grid">
                {coverVariants.map((variant) => {
                  const style = COVER_STYLES.find((item) => item.id === variant.styleId);
                  const label = style?.label ?? 'Uploaded';
                  const isActive = selectedCoverId ? variant.id === selectedCoverId : coverVariants[coverVariants.length - 1].id === variant.id;
                  return (
                    <figure key={variant.id} className={isActive ? 'cover-thumb cover-thumb--active' : 'cover-thumb'}>
                      <button type="button" onClick={() => setSelectedCoverId(variant.id)}>
                        <img src={variant.src} alt={label} />
                      </button>
                      <figcaption>
                        <span>{label}</span>
                        <button type="button" onClick={() => handleRemoveCover(variant.id)}>Remove</button>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            ) : (
              <p className="cover-empty">No cover yet. Generate a preset or upload your own art.</p>
            )}
            <div className="cover-upload-row">
              <label className="ghost-button cover-upload">
                Upload image
                <input type="file" accept="image/*" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleUploadCover(file);
                  }
                }} />
              </label>
              {coverVariants.length > 0 && (
                <button type="button" className="ghost-button" onClick={() => {
                  setCoverVariants([]);
                  setSelectedCoverId(null);
                }}>
                  Clear all
                </button>
              )}
            </div>
          </div>
          <label>
            <span>Short description</span>
            <textarea
              rows={3}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Give readers a hook before they dive in."
            />
          </label>
          <label>
            <span>Tags (comma separated)</span>
            <input
              type="text"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="#fantasy, #foundfamily"
            />
          </label>
          {publishError && <div className="notice notice--error">{publishError}</div>}
          <button type="button" className="primary-button" onClick={handlePublish} disabled={isPublishing}>
            <Upload size={16} /> {isPublishing ? "Publishing..." : "Publish story"}
          </button>
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.82 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Recent drafts</h3>
              <p>Jump back to iterate on earlier branches.</p>
            </div>
          </header>
          <div className="studio-draft-list">
            {drafts.slice(0, 6).map((draft) => (
              <button
                key={draft.id}
                type="button"
                className={draft.id === activeDraft?.id ? "draft-card draft-card--active" : "draft-card"}
                onClick={() => selectDraft(draft.id)}
              >
                <strong>{draft.metadata.title}</strong>
                <span>{new Date(draft.updatedAt ?? draft.generatedAt ?? Date.now()).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.88 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Scene checklist</h3>
              <p>Quickly see which publishing tasks are already covered.</p>
            </div>
          </header>
          <ul className="panel-list">
            {sceneChecklist.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <span className={item.done ? "status-pill status-pill--done" : "status-pill status-pill--todo"}>
                    {item.done ? "Done" : "To do"}
                  </span>
                </div>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.div className="studio-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.94 }}>
          <header className="studio-panel__header">
            <div>
              <h3>Creative spark</h3>
              <p>Use these mini prompts to punch up the current scene.</p>
            </div>
          </header>
          <ul className="panel-list">
            {creativePrompts.map((prompt) => (
              <li key={prompt.id}>
                <div>
                  <strong>{prompt.title}</strong>
                </div>
                <p>{prompt.body}</p>
              </li>
            ))}
          </ul>
        </motion.div>
      </section>
      <div className="studio-sticky-bar">
        <button type="submit" className="primary-button" disabled={isGenerating}>
          <Wand2 size={16} /> {isGenerating ? "Working..." : "Generate"}
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={feedbackLoading !== null || !activeDraft?.content}
          onClick={handleFeedbackClick}
        >
          <MessageSquare size={16} /> {feedbackLoading ? "Processing..." : "Feedback"}
        </button>
      </div>
    </form>
  );
}





