import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Loader2, Scale, ThumbsUp } from "lucide-react";
import type { ProviderDescriptor, ProviderId } from "../../context/ProviderContext";
import type { ModelABExperiment, ModelVariantResult, StoryMetadata } from "../../context/WorkspaceContext";

const MAX_VARIANTS = 3;

interface VariantSelection {
  providerId: ProviderId;
  model: string;
}

interface ModelABExplorerPanelProps {
  metadata: StoryMetadata;
  providers: ProviderDescriptor[];
  modelSelections: Record<ProviderId, string>;
  apiKeys: Record<ProviderId, string>;
  selectedProviderId: ProviderId;
  selectedModel: string;
  experiments: ModelABExperiment[];
  workingExperiment: ModelABExperiment | null;
  onRun: (selection: VariantSelection[]) => Promise<void> | void;
  onMarkWinner: (experimentId: string, variantId: string) => void;
  onAdopt: (experimentId: string, variantId: string) => void;
  error?: string | null;
  isRunning: boolean;
}

interface DiffSummary {
  uniqueSentences: string[];
  overlapScore: number;
}

function sentenceTokens(text?: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function computeDiff(base: string | undefined, candidate: string | undefined): DiffSummary {
  const baseSentences = sentenceTokens(base);
  const candidateSentences = sentenceTokens(candidate);
  if (!baseSentences.length || !candidateSentences.length) {
    return { uniqueSentences: candidateSentences.slice(0, 3), overlapScore: 0 };
  }

  const baseSet = new Set(baseSentences.map((sentence) => sentence.toLowerCase()));
  const unique = candidateSentences.filter((sentence) => !baseSet.has(sentence.toLowerCase()));
  const overlapScore = 1 - unique.length / Math.max(candidateSentences.length, 1);
  return { uniqueSentences: unique.slice(0, 3), overlapScore };
}

export function ModelABExplorerPanel({
  metadata,
  providers,
  modelSelections,
  apiKeys,
  selectedProviderId,
  selectedModel,
  experiments,
  workingExperiment,
  onRun,
  onMarkWinner,
  onAdopt,
  error,
  isRunning,
}: ModelABExplorerPanelProps) {
  const [selection, setSelection] = useState<VariantSelection[]>(() => [
    { providerId: selectedProviderId, model: selectedModel },
  ]);
  const [localError, setLocalError] = useState<string | null>(null);
  const providerMap = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const tokenHint = useMemo(() => {
    if (metadata.targetTokens && metadata.targetTokens > 0) {
      return metadata.targetTokens;
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
  }, [metadata]);

  useEffect(() => {
    setSelection((prev) => {
      const exists = prev.find((item) => item.providerId === selectedProviderId);
      if (exists) {
        return prev.map((item) =>
          item.providerId === selectedProviderId ? { providerId: selectedProviderId, model: selectedModel } : item
        );
      }
      return [{ providerId: selectedProviderId, model: selectedModel }, ...prev].slice(0, MAX_VARIANTS);
    });
  }, [selectedProviderId, selectedModel]);

  const availablePresets = useMemo(() => {
    const combos: Array<{ id: string; label: string; providers: ProviderId[] }> = [
      { id: "openai-anthropic", label: "OpenAI vs Anthropic", providers: ["openai", "anthropic"] },
      { id: "openai-gemini", label: "OpenAI vs Gemini", providers: ["openai", "gemini"] },
      { id: "openai-deepseek", label: "OpenAI vs DeepSeek", providers: ["openai", "deepseek"] },
      { id: "anthropic-gemini", label: "Anthropic vs Gemini", providers: ["anthropic", "gemini"] },
    ];
    return combos.filter((preset) => preset.providers.every((id) => providerMap.has(id)));
  }, [providerMap]);

  const applyPreset = (ids: ProviderId[]) => {
    setLocalError(null);
    setSelection(
      ids.slice(0, MAX_VARIANTS).map((id) => {
        const provider = providerMap.get(id);
        const model = modelSelections[id] ?? provider?.defaultModel ?? "";
        return { providerId: id, model };
      })
    );
  };

  const toggleProvider = (providerId: ProviderId) => {
    setSelection((prev) => {
      const exists = prev.find((item) => item.providerId === providerId);
      if (exists) {
        return prev.filter((item) => item.providerId !== providerId);
      }
      if (prev.length >= MAX_VARIANTS) {
        setLocalError(`Pick up to ${MAX_VARIANTS} providers at once.`);
        return prev;
      }
      const provider = providers.find((p) => p.id === providerId);
      const model = modelSelections[providerId] ?? provider?.defaultModel ?? "";
      return [...prev, { providerId, model }];
    });
  };

  const updateModel = (providerId: ProviderId, model: string) => {
    setSelection((prev) =>
      prev.map((item) => (item.providerId === providerId ? { providerId, model } : item))
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    if (selection.length < 2) {
      setLocalError("Select at least two providers to compare.");
      return;
    }
    await onRun(selection);
  };

  const experimentsToDisplay = useMemo(() => {
    return workingExperiment ? [workingExperiment, ...experiments] : experiments;
  }, [workingExperiment, experiments]);

  return (
    <div className="studio-panel">
      <header className="studio-panel__header">
        <div>
          <h3>Model A/B explorer</h3>
          <p>Stack providers side by side, then vote on the strongest draft.</p>
        </div>
      </header>

      <form className="ab-explorer__form" onSubmit={handleSubmit}>
        <fieldset>
          <legend>Pick competitors</legend>
          <div className="ab-explorer__provider-grid">
            {providers.map((provider) => {
              const checked = selection.some((item) => item.providerId === provider.id);
              const keyReady = Boolean(apiKeys[provider.id]);
              return (
                <label key={provider.id} className={checked ? "ab-provider ab-provider--active" : "ab-provider"}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProvider(provider.id)}
                  />
                  <div>
                    <strong>{provider.label}</strong>
                    <small>{keyReady ? "Key ready" : "Missing key"}</small>
                  </div>
              </label>
            );
          })}
        </div>
        <p className="ab-explorer__hint">Token budget target ≈ {tokenHint}</p>
      </fieldset>

        {availablePresets.length > 0 && (
          <div className="ab-explorer__quick">
            <span>Quick compare:</span>
            <div>
              {availablePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="text-button"
                  onClick={() => applyPreset(preset.providers)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ab-explorer__models">
          {selection.map((item) => {
            const provider = providers.find((p) => p.id === item.providerId);
            if (!provider) return null;
            return (
              <label key={provider.id}>
                <span>{provider.label} model</span>
                <select value={item.model} onChange={(event) => updateModel(provider.id, event.target.value)}>
                  {provider.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>

        {(localError || error) && (
          <div className="notice notice--error">{localError || error}</div>
        )}

        <button type="submit" className="primary-button" disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="spin" size={16} /> Comparing�
            </>
          ) : (
            <>
              <Scale size={16} /> Run comparison
            </>
          )}
        </button>
      </form>

      {experimentsToDisplay.length === 0 ? (
        <div className="ab-explorer__empty">
          <p>
            Pick at least two providers and run a comparison to see side-by-side drafts and cost estimates.
          </p>
        </div>
      ) : (
        <div className="ab-explorer__experiments">
          {experimentsToDisplay.map((experiment) => {
            const base = experiment.variants.find((variant) => variant.status === "success");
            const winnerVariant = experiment.winnerId
              ? experiment.variants.find((variant) => variant.id === experiment.winnerId)
              : null;
            const isCurrentRun = workingExperiment?.id === experiment.id && isRunning;
            return (
              <section key={experiment.id} className="ab-experiment">
                <header>
                  <div>
                    <h4>
                      Comparison run · {new Date(experiment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </h4>
                    <small>{sentenceTokens(experiment.prompt).slice(0, 1).join(" ") || "Prompt snapshot"}</small>
                  </div>
                  {winnerVariant && (
                    <span className="ab-experiment__winner">
                      Winner: {winnerVariant.providerLabel}
                    </span>
                  )}
                </header>
                <div className="ab-experiment__variants">
                  {experiment.variants.map((variant) => {
                    const diff = computeDiff(base?.content, variant.content);
                    const isWinner = experiment.winnerId === variant.id;
                    return (
                      <article
                        key={variant.id}
                        className={
                          isWinner
                            ? "ab-variant-card ab-variant-card--winner"
                            : "ab-variant-card"
                        }
                      >
                        <header>
                          <div>
                            <strong>
                              {variant.providerLabel} · {variant.model}
                            </strong>
                            <span className={`ab-variant-status ab-variant-status--${variant.status}`}>
                              {variant.status === "pending" && (
                                <>
                                  <Loader2 className="spin" size={14} /> Pending
                                </>
                              )}
                              {variant.status === "success" && (
                                <>
                                  <CheckCircle2 size={14} /> Ready
                                </>
                              )}
                              {variant.status === "error" && (
                                <>
                                  <AlertTriangle size={14} /> Failed
                                </>
                              )}
                            </span>
                          </div>
                          <dl>
                            <div>
                              <dt>Cost est.</dt>
                              <dd>${variant.costEstimate.toFixed(3)}</dd>
                            </div>
                            <div>
                              <dt>Tokens</dt>
                              <dd>{variant.tokensUsed ?? variant.estimatedTokens}</dd>
                            </div>
                            {typeof variant.durationMs === "number" && (
                              <div>
                                <dt>Latency</dt>
                                <dd>{Math.round(variant.durationMs)} ms</dd>
                              </div>
                            )}
                          </dl>
                        </header>
                        {variant.status === "error" ? (
                          <p className="ab-variant-error">{variant.error ?? "Generation failed."}</p>
                        ) : (
                          <>
                            <div className="ab-variant-diff">
                              <h5>
                                <BarChart3 size={14} /> Standout beats ({Math.round(diff.overlapScore * 100)}% overlap)
                              </h5>
                              {diff.uniqueSentences.length ? (
                                <ul>
                                  {diff.uniqueSentences.map((sentence, index) => (
                                    <li key={index}>{sentence}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p>No major deviations from baseline.</p>
                              )}
                            </div>
                            <pre className="ab-variant-snippet">
                              {(variant.content ?? "").slice(0, 600) || "Awaiting generation output…"}
                            </pre>
                          </>
                        )}
                        <div className="ab-variant-actions">
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={variant.status !== "success" || isCurrentRun}
                            onClick={() => onMarkWinner(experiment.id, variant.id)}
                          >
                            <ThumbsUp size={16} /> Vote winner
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={variant.status !== "success"}
                            onClick={() => onAdopt(experiment.id, variant.id)}
                          >
                            <CheckCircle2 size={16} /> Adopt draft
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
