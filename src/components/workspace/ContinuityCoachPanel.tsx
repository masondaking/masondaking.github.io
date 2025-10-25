import { FormEvent, useMemo, useState } from "react";
import { BookUser, Edit3, Info, PlusCircle, Trash2 } from "lucide-react";
import type {
  ContinuityEntry,
  ContinuityEntryInput,
  ContinuityEntryType,
} from "../../context/WorkspaceContext";

export interface ContinuityWarning {
  id: string;
  severity: "info" | "warn" | "error";
  message: string;
  suggestion?: string;
  candidate?: { label: string; type: ContinuityEntryType };
}

interface ContinuityCoachPanelProps {
  entries: ContinuityEntry[];
  warnings: ContinuityWarning[];
  onCreate: (input: ContinuityEntryInput) => void;
  onUpdate: (entryId: string, patch: ContinuityEntryInput) => void;
  onDelete: (entryId: string) => void;
  onQuickAdd: (candidate: { label: string; type: ContinuityEntryType }) => void;
}

const typeLabels: Record<ContinuityEntryType, string> = {
  character: "Character",
  plot: "Plot thread",
  world: "World fact",
};

function traitsToString(traits: string[]): string {
  return traits.join(", ");
}

function parseTraits(input: string): string[] {
  return input
    .split(",")
    .map((trait) => trait.trim())
    .filter(Boolean);
}

export function ContinuityCoachPanel({
  entries,
  warnings,
  onCreate,
  onUpdate,
  onDelete,
  onQuickAdd,
}: ContinuityCoachPanelProps) {
  const [formType, setFormType] = useState<ContinuityEntryType>("character");
  const [formLabel, setFormLabel] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formTraits, setFormTraits] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingSummary, setEditingSummary] = useState("");
  const [editingTraits, setEditingTraits] = useState("");

  const grouped = useMemo(() => {
    return entries.reduce<Record<ContinuityEntryType, ContinuityEntry[]>>(
      (acc, entry) => {
        acc[entry.type] = acc[entry.type] ? [...acc[entry.type], entry] : [entry];
        return acc;
      },
      { character: [], plot: [], world: [] }
    );
  }, [entries]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formLabel.trim()) return;
    onCreate({
      type: formType,
      label: formLabel.trim(),
      summary: formSummary.trim(),
      traits: parseTraits(formTraits),
    });
    setFormLabel("");
    setFormSummary("");
    setFormTraits("");
  };

  const startEditing = (entry: ContinuityEntry) => {
    setEditingId(entry.id);
    setEditingLabel(entry.label);
    setEditingSummary(entry.summary);
    setEditingTraits(traitsToString(entry.traits));
  };

  const commitEdit = (entry: ContinuityEntry) => {
    if (!editingId) return;
    onUpdate(entry.id, {
      type: entry.type,
      label: editingLabel.trim() || entry.label,
      summary: editingSummary.trim(),
      traits: parseTraits(editingTraits),
    });
    setEditingId(null);
    setEditingLabel("");
    setEditingSummary("");
    setEditingTraits("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingLabel("");
    setEditingSummary("");
    setEditingTraits("");
  };

  return (
    <div className="studio-panel continuity-panel">
      <header className="studio-panel__header">
        <div>
          <h3>Continuity coach</h3>
          <p>Track characters, threads, and world details as you draft.</p>
        </div>
      </header>

      <form className="continuity-form" onSubmit={handleSubmit}>
        <label>
          <span>Entry type</span>
          <select value={formType} onChange={(event) => setFormType(event.target.value as ContinuityEntryType)}>
            <option value="character">Character</option>
            <option value="plot">Plot thread</option>
            <option value="world">World fact</option>
          </select>
        </label>
        <label>
          <span>Name / label</span>
          <input
            value={formLabel}
            onChange={(event) => setFormLabel(event.target.value)}
            placeholder="e.g. Captain Mara Ives"
          />
        </label>
        <label>
          <span>Summary</span>
          <textarea
            rows={3}
            value={formSummary}
            onChange={(event) => setFormSummary(event.target.value)}
            placeholder="Role, motivations, key beats, or world rules."
          />
        </label>
        <label>
          <span>Key traits (comma separated)</span>
          <input
            value={formTraits}
            onChange={(event) => setFormTraits(event.target.value)}
            placeholder="green eyes, veteran pilot, secret agenda"
          />
        </label>
        <button type="submit" className="ghost-button">
          <PlusCircle size={16} /> Add to continuity
        </button>
      </form>

      {warnings.length > 0 && (
        <div className="continuity-warnings">
          {warnings.map((warning) => (
            <article key={warning.id} className={`continuity-warning continuity-warning--${warning.severity}`}>
              <span className="continuity-warning__icon">
                {warning.severity === "error" ? <BookUser size={14} /> : warning.severity === "warn" ? <Info size={14} /> : <Info size={14} />}
              </span>
              <div>
                <p>{warning.message}</p>
                {warning.suggestion && <small>{warning.suggestion}</small>}
                {warning.candidate && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => onQuickAdd(warning.candidate!)}
                  >
                    Track {warning.candidate.label}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="continuity-groups">
        {(Object.keys(grouped) as ContinuityEntryType[]).map((type) => (
          <section key={type} className="continuity-group">
            <header>
              <h4>{typeLabels[type]}</h4>
              <span>{grouped[type].length}</span>
            </header>
            {grouped[type].length === 0 ? (
              <p className="continuity-empty">Nothing tracked yet.</p>
            ) : (
              <ul>
                {grouped[type].map((entry) => {
                  const isEditing = editingId === entry.id;
                  return (
                    <li key={entry.id} className="continuity-entry">
                      <div className="continuity-entry__header">
                        <strong>{isEditing ? (
                          <input value={editingLabel} onChange={(event) => setEditingLabel(event.target.value)} />
                        ) : (
                          entry.label
                        )}</strong>
                        <div className="continuity-entry__actions">
                          {isEditing ? (
                            <>
                              <button type="button" className="ghost-button" onClick={() => commitEdit(entry)}>
                                Save
                              </button>
                              <button type="button" className="ghost-button" onClick={cancelEdit}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="ghost-button" onClick={() => startEditing(entry)}>
                                <Edit3 size={14} /> Edit
                              </button>
                              <button type="button" className="ghost-button ghost-button--danger" onClick={() => onDelete(entry.id)}>
                                <Trash2 size={14} /> Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="continuity-entry__body">
                        {isEditing ? (
                          <textarea
                            rows={3}
                            value={editingSummary}
                            onChange={(event) => setEditingSummary(event.target.value)}
                          />
                        ) : (
                          <p>{entry.summary || "No summary yet."}</p>
                        )}
                        <div className="continuity-entry__traits">
                          <span>Traits</span>
                          {isEditing ? (
                            <input
                              value={editingTraits}
                              onChange={(event) => setEditingTraits(event.target.value)}
                              placeholder="comma separated traits"
                            />
                          ) : entry.traits.length ? (
                            <ul>
                              {entry.traits.map((trait) => (
                                <li key={trait}>{trait}</li>
                              ))}
                            </ul>
                          ) : (
                            <small>None listed.</small>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
