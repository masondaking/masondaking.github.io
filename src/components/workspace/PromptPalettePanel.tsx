import { FormEvent, useMemo, useState } from "react";
import { BookmarkPlus, Copy, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { PromptRecipe, PromptRecipeInput, StoryMetadata } from "../../context/WorkspaceContext";

interface PromptPalettePanelProps {
  currentPrompt: string;
  metadata: StoryMetadata;
  selectedModel?: string;
  recipes: PromptRecipe[];
  onSaveRecipe: (input: PromptRecipeInput) => void;
  onApplyRecipe: (recipe: PromptRecipe) => void;
  onRemixRecipe: (recipe: PromptRecipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onShareRecipe: (recipe: PromptRecipe) => Promise<void> | void;
}

function toTags(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`));
}

export function PromptPalettePanel({
  currentPrompt,
  metadata,
  selectedModel,
  recipes,
  onSaveRecipe,
  onApplyRecipe,
  onRemixRecipe,
  onDeleteRecipe,
  onShareRecipe,
}: PromptPalettePanelProps) {
  const [title, setTitle] = useState("");
  const [toneNotes, setToneNotes] = useState(metadata.tone);
  const [pacingNotes, setPacingNotes] = useState(() => {
    switch (metadata.targetLength) {
      case "short":
        return "Keep momentum punchy and end on a strong image.";
      case "medium":
        return "Balance rising tension with reflective beats.";
      case "long":
        return "Layer subplots and allow quieter character moments.";
      default:
        return "";
    }
  });
  const [bestModel, setBestModel] = useState(selectedModel ?? "");
  const [tagInput, setTagInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"muted" | "error">("muted");

  const promptEmpty = currentPrompt.trim().length === 0;
  const disabled = promptEmpty || !title.trim();

  const sortedRecipes = useMemo(
    () => [...recipes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [recipes]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (promptEmpty) {
      setStatusTone("error");
      setStatusMessage("Write or paste a prompt before saving it to the palette.");
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setStatusTone("error");
      setStatusMessage("Name your recipe so you can find it again later.");
      return;
    }
    const payload: PromptRecipeInput = {
      title: trimmedTitle,
      prompt: currentPrompt,
      toneNotes: toneNotes.trim() || undefined,
      pacingNotes: pacingNotes.trim() || undefined,
      bestModel: bestModel.trim() || undefined,
      tags: toTags(tagInput),
    };
    onSaveRecipe(payload);
    setTitle("");
    setToneNotes(metadata.tone);
    setPacingNotes("");
    setBestModel(selectedModel ?? "");
    setTagInput("");
    setStatusTone("muted");
    setStatusMessage(`Saved "${trimmedTitle}" to your palette.`);
  };

  return (
    <div className="studio-panel">
      <header className="studio-panel__header">
        <div>
          <h3>Prompt palette</h3>
          <p>Save, remix, and resurface your strongest setups.</p>
        </div>
      </header>

      <form className="prompt-palette__form" onSubmit={handleSubmit}>
        <label>
          <span>Recipe name</span>
          <input
            value={title}
            placeholder="Oceanic heist inciting prompt"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          <span>Tone notes</span>
          <input
            value={toneNotes}
            placeholder="Gritty, neon-lit, but hopeful underneath"
            onChange={(event) => setToneNotes(event.target.value)}
          />
        </label>
        <label>
          <span>Pacing notes</span>
          <textarea
            rows={2}
            value={pacingNotes}
            placeholder="Open with a sharp hook, escalate in two beats, breathe before the midpoint twist."
            onChange={(event) => setPacingNotes(event.target.value)}
          />
        </label>
        <div className="prompt-palette__meta">
          <label>
            <span>Best-fit model</span>
            <input
              value={bestModel}
              placeholder="e.g. gpt-4o-mini"
              onChange={(event) => setBestModel(event.target.value)}
            />
          </label>
          <label>
            <span>Signals / tags</span>
            <input
              value={tagInput}
              placeholder="#noir, #character-driven"
              onChange={(event) => setTagInput(event.target.value)}
            />
          </label>
        </div>
        {statusMessage && (
          <div className={`notice ${statusTone === "error" ? "notice--error" : "notice--muted"}`}>
            {statusMessage}
          </div>
        )}
        <button type="submit" className="primary-button" disabled={disabled}>
          <BookmarkPlus size={16} /> Save recipe
        </button>
      </form>

      <hr className="prompt-palette__divider" />

      <div className="prompt-palette__list">
        {sortedRecipes.length === 0 ? (
          <p className="studio-output__placeholder">
            Save your current prompt to build a reusable palette of openers and tonal guides.
          </p>
        ) : (
          sortedRecipes.map((recipe) => (
            <article key={recipe.id} className="prompt-recipe-card">
              <header>
                <div>
                  <h4>{recipe.title}</h4>
                  <div className="prompt-recipe-card__meta">
                    {recipe.bestModel && <span>Model: {recipe.bestModel}</span>}
                    {recipe.tags?.length ? <span>{recipe.tags.join(" ")}</span> : null}
                  </div>
                </div>
                <time>{new Date(recipe.updatedAt).toLocaleDateString()}</time>
              </header>
              <p className="prompt-recipe-card__notes">
                {recipe.toneNotes && (
                  <span>
                    <strong>Tone:</strong> {recipe.toneNotes}
                  </span>
                )}
                {recipe.pacingNotes && (
                  <span>
                    <strong>Pacing:</strong> {recipe.pacingNotes}
                  </span>
                )}
              </p>
              <pre className="prompt-recipe-card__prompt">{recipe.prompt}</pre>
              <div className="prompt-recipe-card__actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    onApplyRecipe(recipe);
                    setStatusTone("muted");
                    setStatusMessage(`Loaded "${recipe.title}" into the editor.`);
                  }}
                >
                  <Sparkles size={16} /> Use
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    onRemixRecipe(recipe);
                    setStatusTone("muted");
                    setStatusMessage(`Remixed a fresh variant of "${recipe.title}".`);
                  }}
                >
                  <RefreshCw size={16} /> Remix
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={async () => {
                    try {
                      await onShareRecipe(recipe);
                      setStatusTone("muted");
                      setStatusMessage("Copied a sharable prompt bundle to your clipboard.");
                    } catch (shareError) {
                      console.error(shareError);
                      setStatusTone("error");
                      setStatusMessage("Unable to copy the recipe. Check clipboard permissions and try again.");
                    }
                  }}
                >
                  <Copy size={16} /> Share
                </button>
                <button
                  type="button"
                  className="ghost-button ghost-button--danger"
                  onClick={() => {
                    onDeleteRecipe(recipe.id);
                    setStatusTone("muted");
                    setStatusMessage(`Removed "${recipe.title}" from your palette.`);
                  }}
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
