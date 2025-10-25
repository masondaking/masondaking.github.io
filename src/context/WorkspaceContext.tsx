import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import { generateId } from "../utils/crypto";
import type { ProviderId } from "./ProviderContext";

export type StoryLength = "short" | "medium" | "long";

export interface StoryMetadata {
  title: string;
  genre: string;
  tone: string;
  perspective: string;
  targetLength: StoryLength;
  // Optional override: if set, generation will use this exact token budget
  targetTokens?: number;
}

export interface FeedbackThread {
  id: string;
  provider: string;
  focus: "grammar" | "dialogue" | "flow" | "custom";
  request: string;
  response: string;
  createdAt: string;
}

export interface StoryDraft {
  id: string;
  metadata: StoryMetadata;
  prompt: string;
  summary: string;
  content: string;
  generatedAt?: string;
  updatedAt: string;
  feedbackThreads: FeedbackThread[];
  abExperiments: ModelABExperiment[];
  continuity: ContinuitySnapshot;
  sensoryPasses: SensoryPass[];
}

export interface PromptRecipe {
  id: string;
  title: string;
  prompt: string;
  toneNotes?: string;
  pacingNotes?: string;
  bestModel?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptRecipeInput {
  title: string;
  prompt: string;
  toneNotes?: string;
  pacingNotes?: string;
  bestModel?: string;
  tags?: string[];
}

export type ModelVariantStatus = "pending" | "success" | "error";

export interface ModelVariantResult {
  id: string;
  providerId: ProviderId;
  providerLabel: string;
  model: string;
  status: ModelVariantStatus;
  costEstimate: number;
  estimatedTokens: number;
  tokensUsed?: number;
  content?: string;
  error?: string;
  durationMs?: number;
  createdAt: string;
}

export interface ModelABExperiment {
  id: string;
  createdAt: string;
  prompt: string;
  summary?: string;
  variants: ModelVariantResult[];
  winnerId?: string | null;
}

export type ContinuityEntryType = "character" | "plot" | "world";

export interface ContinuityEntry {
  id: string;
  type: ContinuityEntryType;
  label: string;
  summary: string;
  traits: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContinuityEntryInput {
  type: ContinuityEntryType;
  label: string;
  summary: string;
  traits?: string[];
}

export interface ContinuitySnapshot {
  entries: ContinuityEntry[];
}

export type SensoryPassType = "sensory" | "dialogue" | "pacing";

export interface SensoryPass {
  id: string;
  kind: SensoryPassType;
  createdAt: string;
  response: string;
}

interface WorkspaceState {
  drafts: StoryDraft[];
  activeDraftId: string | null;
  promptRecipes: PromptRecipe[];
}

interface WorkspaceContextValue {
  drafts: StoryDraft[];
  activeDraft: StoryDraft | null;
  createDraft: (input: { metadata: StoryMetadata; prompt: string; summary?: string }) => StoryDraft;
  updateDraft: (draftId: string, patch: Partial<StoryDraft>) => void;
  appendContent: (draftId: string, content: string, timestamp?: string) => void;
  addFeedback: (draftId: string, feedback: Omit<FeedbackThread, "id" | "createdAt">) => FeedbackThread;
  selectDraft: (draftId: string) => void;
  resetWorkspace: () => void;
  promptRecipes: PromptRecipe[];
  createPromptRecipe: (input: PromptRecipeInput) => PromptRecipe;
  updatePromptRecipe: (recipeId: string, patch: Partial<PromptRecipeInput>) => void;
  deletePromptRecipe: (recipeId: string) => void;
  addContinuityEntry: (draftId: string, input: ContinuityEntryInput) => ContinuityEntry;
  updateContinuityEntry: (draftId: string, entryId: string, patch: Partial<ContinuityEntryInput>) => void;
  deleteContinuityEntry: (draftId: string, entryId: string) => void;
  addSensoryPass: (draftId: string, pass: SensoryPass) => void;
}

const STORAGE_KEY = "sf:workspace";

function normaliseRecipe(recipe: PromptRecipe): PromptRecipe {
  return {
    ...recipe,
    title: recipe.title?.trim() || "Untitled recipe",
    prompt: recipe.prompt,
    toneNotes: recipe.toneNotes?.trim() || undefined,
    pacingNotes: recipe.pacingNotes?.trim() || undefined,
    bestModel: recipe.bestModel?.trim() || undefined,
    tags: Array.isArray(recipe.tags) ? recipe.tags.filter(Boolean) : [],
    createdAt: recipe.createdAt ?? new Date().toISOString(),
    updatedAt: recipe.updatedAt ?? new Date().toISOString(),
  };
}

function normaliseExperiment(experiment: ModelABExperiment): ModelABExperiment {
  return {
    ...experiment,
    createdAt: experiment.createdAt ?? new Date().toISOString(),
    prompt: experiment.prompt ?? "",
    summary: experiment.summary ?? "",
    winnerId: experiment.winnerId ?? null,
    variants: (experiment.variants || []).map((variant) => ({
      ...variant,
      status: (variant.status as ModelVariantStatus) || "success",
      costEstimate: Number.isFinite(variant.costEstimate) ? variant.costEstimate : 0,
      estimatedTokens: Number.isFinite(variant.estimatedTokens) ? variant.estimatedTokens : 0,
      createdAt: variant.createdAt ?? experiment.createdAt ?? new Date().toISOString(),
    })),
  };
}

function normaliseContinuityEntry(entry: ContinuityEntry): ContinuityEntry {
  return {
    ...entry,
    label: entry.label?.trim() || "Untitled",
    summary: entry.summary?.trim() || "",
    traits: Array.isArray(entry.traits) ? entry.traits.filter(Boolean) : [],
    createdAt: entry.createdAt ?? new Date().toISOString(),
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  };
}

function normaliseSensoryPass(pass: SensoryPass): SensoryPass {
  return {
    ...pass,
    kind: pass.kind ?? "sensory",
    response: pass.response ?? "",
    createdAt: pass.createdAt ?? new Date().toISOString(),
  };
}

function loadInitialState(): WorkspaceState {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { drafts: [], activeDraftId: null, promptRecipes: [] };
  }
  try {
    const parsed = JSON.parse(stored) as Partial<WorkspaceState> & { drafts?: StoryDraft[]; promptRecipes?: PromptRecipe[] };
    const drafts = (parsed.drafts || []).map((draft) => ({
      ...draft,
      summary: draft.summary ?? "",
      updatedAt: draft.updatedAt ?? draft.generatedAt ?? new Date().toISOString(),
      feedbackThreads: draft.feedbackThreads ?? [],
      abExperiments: (draft.abExperiments || []).map(normaliseExperiment),
      continuity: {
        entries: draft.continuity?.entries ? draft.continuity.entries.map(normaliseContinuityEntry) : [],
      },
      sensoryPasses: (draft.sensoryPasses || []).map(normaliseSensoryPass),
    }));
    const promptRecipes = (parsed.promptRecipes || []).map(normaliseRecipe);
    return {
      drafts,
      activeDraftId: parsed.activeDraftId ?? drafts[0]?.id ?? null,
      promptRecipes,
    };
  } catch (error) {
    console.error("Failed to parse workspace", error);
    return { drafts: [], activeDraftId: null, promptRecipes: [] };
  }
}

function persist(state: WorkspaceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

type WorkspaceAction =
  | { type: "create"; draft: StoryDraft }
  | { type: "update"; draftId: string; patch: Partial<StoryDraft> }
  | { type: "append"; draftId: string; content: string; timestamp?: string }
  | { type: "feedback"; draftId: string; feedback: FeedbackThread }
  | { type: "select"; draftId: string }
  | { type: "reset" }
  | { type: "prompt_upsert"; recipe: PromptRecipe }
  | { type: "prompt_delete"; recipeId: string }
  | { type: "continuity_add"; draftId: string; entry: ContinuityEntry }
  | { type: "continuity_update"; draftId: string; entry: ContinuityEntry }
  | { type: "continuity_delete"; draftId: string; entryId: string }
  | { type: "sensory_pass_add"; draftId: string; pass: SensoryPass };

function reducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "create": {
      const drafts = [action.draft, ...state.drafts];
      const next = { ...state, drafts, activeDraftId: action.draft.id };
      persist(next);
      return next;
    }
    case "update": {
      const drafts = state.drafts.map((draft) =>
        draft.id === action.draftId
          ? { ...draft, ...action.patch, updatedAt: new Date().toISOString() }
          : draft
      );
      const next = { ...state, drafts };
      persist(next);
      return next;
    }
    case "append": {
      const drafts = state.drafts.map((draft) =>
        draft.id === action.draftId
          ? {
              ...draft,
              content: draft.content + action.content,
              generatedAt: action.timestamp ?? new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : draft
      );
      const next = { ...state, drafts };
      persist(next);
      return next;
    }
    case "feedback": {
      const drafts = state.drafts.map((draft) =>
        draft.id === action.draftId
          ? {
              ...draft,
              feedbackThreads: [action.feedback, ...draft.feedbackThreads],
              updatedAt: new Date().toISOString(),
            }
          : draft
      );
      const next = { ...state, drafts };
      persist(next);
      return next;
    }
    case "select": {
      const next = { ...state, activeDraftId: action.draftId };
      persist(next);
      return next;
    }
    case "reset": {
      const next = { ...state, drafts: [], activeDraftId: null };
      persist(next);
      return next;
    }
    case "prompt_upsert": {
      const exists = state.promptRecipes.find((recipe) => recipe.id === action.recipe.id);
      const promptRecipes = exists
        ? state.promptRecipes.map((recipe) => (recipe.id === action.recipe.id ? action.recipe : recipe))
        : [action.recipe, ...state.promptRecipes];
      const next = { ...state, promptRecipes };
      persist(next);
      return next;
    }
    case "prompt_delete": {
      const promptRecipes = state.promptRecipes.filter((recipe) => recipe.id !== action.recipeId);
      const next = { ...state, promptRecipes };
      persist(next);
      return next;
    }
    case "continuity_add": {
      const drafts = state.drafts.map((draft) =>
        draft.id === action.draftId
          ? {
              ...draft,
              continuity: {
                entries: [action.entry, ...(draft.continuity?.entries ?? [])],
              },
              updatedAt: new Date().toISOString(),
            }
          : draft
      );
      const next = { ...state, drafts };
      persist(next);
      return next;
    }
    case "continuity_update": {
      const drafts = state.drafts.map((draft) =>
        draft.id === action.draftId
          ? {
              ...draft,
              continuity: {
                entries: (draft.continuity?.entries ?? []).map((entry) =>
                  entry.id === action.entry.id ? action.entry : entry
                ),
              },
              updatedAt: new Date().toISOString(),
            }
          : draft
      );
      const next = { ...state, drafts };
      persist(next);
      return next;
    }
    case "continuity_delete": {
      const drafts = state.drafts.map((draft) =>
        draft.id === action.draftId
          ? {
              ...draft,
              continuity: {
                entries: (draft.continuity?.entries ?? []).filter((entry) => entry.id !== action.entryId),
              },
              updatedAt: new Date().toISOString(),
            }
          : draft
      );
      const next = { ...state, drafts };
      persist(next);
      return next;
    }
    case "sensory_pass_add": {
      const drafts = state.drafts.map((draft) =>
        draft.id === action.draftId
          ? {
              ...draft,
              sensoryPasses: [action.pass, ...(draft.sensoryPasses ?? [])],
              updatedAt: new Date().toISOString(),
            }
          : draft
      );
      const next = { ...state, drafts };
      persist(next);
      return next;
    }
    default:
      return state;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  const createDraft = useCallback<WorkspaceContextValue["createDraft"]>(({ metadata, prompt, summary }) => {
    const draft: StoryDraft = {
      id: generateId("draft"),
      metadata,
      prompt,
      summary: summary ?? "",
      content: "",
      feedbackThreads: [],
      abExperiments: [],
      continuity: { entries: [] },
      sensoryPasses: [],
      generatedAt: undefined,
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: "create", draft });
    return draft;
  }, []);

  const updateDraft = useCallback<WorkspaceContextValue["updateDraft"]>((draftId, patch) => {
    dispatch({ type: "update", draftId, patch });
  }, []);

  const appendContent = useCallback<WorkspaceContextValue["appendContent"]>((draftId, content, timestamp) => {
    dispatch({ type: "append", draftId, content, timestamp });
  }, []);

  const addFeedback = useCallback<WorkspaceContextValue["addFeedback"]>((draftId, feedback) => {
    const entry: FeedbackThread = {
      id: generateId("fbk"),
      createdAt: new Date().toISOString(),
      ...feedback,
    };
    dispatch({ type: "feedback", draftId, feedback: entry });
    return entry;
  }, []);

  const selectDraft = useCallback<WorkspaceContextValue["selectDraft"]>((draftId) => {
    dispatch({ type: "select", draftId });
  }, []);

  const resetWorkspace = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  const createPromptRecipe = useCallback<WorkspaceContextValue["createPromptRecipe"]>((input) => {
    const timestamp = new Date().toISOString();
    const recipe: PromptRecipe = normaliseRecipe({
      id: generateId("prompt"),
      createdAt: timestamp,
      updatedAt: timestamp,
      title: input.title,
      prompt: input.prompt,
      toneNotes: input.toneNotes,
      pacingNotes: input.pacingNotes,
      bestModel: input.bestModel,
      tags: input.tags,
    });
    dispatch({ type: "prompt_upsert", recipe });
    return recipe;
  }, []);

  const updatePromptRecipe = useCallback<WorkspaceContextValue["updatePromptRecipe"]>(
    (recipeId, patch) => {
      const existing = state.promptRecipes.find((recipe) => recipe.id === recipeId);
      if (!existing) {
        console.warn(`Attempted to update missing recipe ${recipeId}`);
        return;
      }
      const timestamp = new Date().toISOString();
      const next = normaliseRecipe({
        ...existing,
        title: patch.title ?? existing.title,
        prompt: patch.prompt ?? existing.prompt,
        toneNotes: patch.toneNotes ?? existing.toneNotes,
        pacingNotes: patch.pacingNotes ?? existing.pacingNotes,
        bestModel: patch.bestModel ?? existing.bestModel,
        tags: patch.tags ?? existing.tags,
        createdAt: existing.createdAt,
        updatedAt: timestamp,
      });
      dispatch({ type: "prompt_upsert", recipe: next });
    },
    [state.promptRecipes]
  );

  const deletePromptRecipe = useCallback<WorkspaceContextValue["deletePromptRecipe"]>((recipeId) => {
    dispatch({ type: "prompt_delete", recipeId });
  }, []);

  const addContinuityEntry = useCallback<WorkspaceContextValue["addContinuityEntry"]>((draftId, input) => {
    const entry = normaliseContinuityEntry({
      id: generateId("continuity"),
      type: input.type,
      label: input.label,
      summary: input.summary,
      traits: input.traits ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    dispatch({ type: "continuity_add", draftId, entry });
    return entry;
  }, []);

  const updateContinuityEntry = useCallback<WorkspaceContextValue["updateContinuityEntry"]>(
    (draftId, entryId, patch) => {
      const draft = state.drafts.find((item) => item.id === draftId);
      if (!draft) {
        console.warn(`Attempted to update continuity on missing draft ${draftId}`);
        return;
      }
      const existing = draft.continuity?.entries.find((entry) => entry.id === entryId);
      if (!existing) {
        console.warn(`Attempted to update missing continuity entry ${entryId}`);
        return;
      }
      const entry = normaliseContinuityEntry({
        ...existing,
        type: patch.type ?? existing.type,
        label: patch.label ?? existing.label,
        summary: patch.summary ?? existing.summary,
        traits: patch.traits ?? existing.traits,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      });
      dispatch({ type: "continuity_update", draftId, entry });
    },
    [state.drafts]
  );

  const deleteContinuityEntry = useCallback<WorkspaceContextValue["deleteContinuityEntry"]>((draftId, entryId) => {
    dispatch({ type: "continuity_delete", draftId, entryId });
  }, []);

  const addSensoryPass = useCallback<WorkspaceContextValue["addSensoryPass"]>((draftId, pass) => {
    const normalized = normaliseSensoryPass(pass);
    dispatch({ type: "sensory_pass_add", draftId, pass: normalized });
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => {
    const activeDraft = state.activeDraftId
      ? state.drafts.find((draft) => draft.id === state.activeDraftId) ?? null
      : state.drafts[0] ?? null;

    return {
      drafts: state.drafts,
      activeDraft,
      createDraft,
      updateDraft,
      appendContent,
      addFeedback,
      selectDraft,
      resetWorkspace,
      promptRecipes: state.promptRecipes,
      createPromptRecipe,
      updatePromptRecipe,
      deletePromptRecipe,
      addContinuityEntry,
      updateContinuityEntry,
      deleteContinuityEntry,
      addSensoryPass,
    };
  }, [
    state,
    createDraft,
    updateDraft,
    appendContent,
    addFeedback,
    selectDraft,
    resetWorkspace,
    createPromptRecipe,
    updatePromptRecipe,
    deletePromptRecipe,
    addContinuityEntry,
    updateContinuityEntry,
    deleteContinuityEntry,
    addSensoryPass,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
