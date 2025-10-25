import { ChangeEvent } from "react";
import { StoryMetadata, StoryLength } from "../../context/WorkspaceContext";

const lengthLabels: Record<StoryLength, string> = {
  short: "Short (flash, about 800 words)",
  medium: "Medium (about 2k words)",
  long: "Long (3k+ words)",
};

interface StoryMetadataFormProps {
  metadata: StoryMetadata;
  onChange: (metadata: StoryMetadata) => void;
}

export function StoryMetadataForm({ metadata, onChange }: StoryMetadataFormProps) {
  const handleInput = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    onChange({ ...metadata, [name]: value });
  };

  const setLength = (length: StoryLength) => onChange({ ...metadata, targetLength: length });
  const toneSuggestions = ["Witty", "Eerie", "Lyrical", "Moody", "Optimistic"];
  const handleAddTone = (tone: string) => {
    const parts = metadata.tone
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.includes(tone)) {
      const next = parts.length ? `${metadata.tone.trim()}, ${tone}` : tone;
      onChange({ ...metadata, tone: next });
    }
  };
  const tokensFor = (length: StoryLength) => (length === "short" ? "~900" : length === "medium" ? "~1500" : "~2200");

  return (
    <div className="studio-panel">
      <header className="studio-panel__header">
        <div>
          <h3>Story profile</h3>
          <p>Shape the vibe, perspective, and pacing before you generate.</p>
        </div>
      </header>
      <div className="studio-form-grid">
        <label>
          <span>Title</span>
          <input name="title" value={metadata.title} onChange={handleInput} placeholder="The Clockwork Garden" />
          <small>Give your draft a memorable working title.</small>
        </label>
        <label>
          <span>Genre</span>
          <input name="genre" value={metadata.genre} onChange={handleInput} placeholder="Solarpunk mystery" />
          <small>e.g., Cozy fantasy, Near-future sci-fi, Gothic romance</small>
        </label>
        <label>
          <span>Tone</span>
          <input name="tone" value={metadata.tone} onChange={handleInput} placeholder="Warm, hopeful, poetic" />
          <div className="chip-group" style={{ marginTop: 6 }}>
            {toneSuggestions.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => handleAddTone(s)}>
                {s}
              </button>
            ))}
          </div>
        </label>
        <label>
          <span>Perspective</span>
          <input name="perspective" value={metadata.perspective} onChange={handleInput} placeholder="First person" />
          <small>Examples: First person, Close third, Omniscient</small>
        </label>
        <div>
          <span>Target length</span>
          <div className="chip-group" style={{ marginTop: 6 }}>
            {(Object.keys(lengthLabels) as StoryLength[]).map((length) => (
              <button
                key={length}
                type="button"
                className={metadata.targetLength === length ? "chip chip--active" : "chip"}
                onClick={() => setLength(length)}
              >
                {lengthLabels[length].split(" (")[0]}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            <label>
              <span>Custom tokens (optional)</span>
              <input
                type="number"
                min={1}
                step={1}
                name="targetTokens"
                value={Number.isFinite(metadata.targetTokens as number) ? String(metadata.targetTokens) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = v === "" ? undefined : Math.max(1, Math.floor(Number(v)) || 0);
                  onChange({ ...metadata, targetTokens: n });
                }}
                placeholder="e.g. 5000"
              />
            </label>
            <small>
              {metadata.targetTokens && metadata.targetTokens > 0
                ? `Using custom budget: ${metadata.targetTokens} tokens`
                : `Token budget hint: ${tokensFor(metadata.targetLength)} tokens`}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
