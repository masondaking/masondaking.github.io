import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { generateId } from "../utils/crypto";

export type ProviderId = "openai" | "anthropic" | "gemini" | "deepseek" | `custom:${string}`;

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  models: string[];
  docsUrl: string;
  defaultModel: string;
  type: "chat" | "text";
}

interface ProviderContextValue {
  providers: ProviderDescriptor[];
  selectedProvider: ProviderDescriptor;
  selectedModel: string;
  apiKeys: Record<ProviderId, string>;
  modelSelections: Record<ProviderId, string>;
  setApiKey: (provider: ProviderId, key: string) => void;
  selectProvider: (providerId: ProviderId) => void;
  setModel: (provider: ProviderId, model: string) => void;
  registerCustomProvider: (input: { label: string; docsUrl?: string; models?: string[] }) => ProviderDescriptor;
}

const ProviderRegistryContext = createContext<ProviderContextValue | undefined>(undefined);

const STORAGE_KEYS_KEY = "sf:provider-keys";
const STORAGE_SELECTED_KEY = "sf:provider-selected";
const STORAGE_CUSTOM_KEY = "sf:provider-custom";
const STORAGE_MODEL_KEY = "sf:provider-models";

const defaultProviders: ProviderDescriptor[] = [
  {
    id: "openai",
    label: "OpenAI",
    docsUrl: "https://platform.openai.com/docs",
    models: ["gpt-4o-mini", "gpt-4o"],
    defaultModel: "gpt-4o-mini",
    type: "chat",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    docsUrl: "https://docs.anthropic.com",
    models: ["claude-3-5-haiku-latest", "claude-3-5-sonnet", "claude-3-5-opus", "claude-3-opus", "claude-3-haiku"],
    defaultModel: "claude-3-5-haiku-latest",
    type: "chat",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    models: [
      "gemini-1.5-flash-001",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-flash-8b-001",
      "gemini-1.5-pro-001",
      "gemini-1.5-pro",
      "gemini-1.5-pro-exp",
    ],
    defaultModel: "gemini-1.5-flash-001",
    type: "chat",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    docsUrl: "https://api-docs.deepseek.com/",
    models: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder", "deepseek-math"],
    defaultModel: "deepseek-chat",
    type: "chat",
  },
];

function load<T>(key: string, fallback: T): T {
  const stored = localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch (error) {
    console.error(`Failed to parse ${key}`, error);
    return fallback;
  }
}

export function ProviderRegistryProvider({ children }: { children: ReactNode }) {
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>(() => load(STORAGE_KEYS_KEY, {} as Record<ProviderId, string>));
  const [customProviders, setCustomProviders] = useState<ProviderDescriptor[]>(() => load(STORAGE_CUSTOM_KEY, [] as ProviderDescriptor[]));
  const [selectedId, setSelectedId] = useState<ProviderId>(() => load(STORAGE_SELECTED_KEY, defaultProviders[0].id));
  const [modelSelections, setModelSelections] = useState<Record<ProviderId, string>>(() => load(STORAGE_MODEL_KEY, {} as Record<ProviderId, string>));

  const providers = useMemo(() => [...defaultProviders, ...customProviders], [customProviders]);

  const selectedProvider = useMemo(() => {
    const match = providers.find((provider) => provider.id === selectedId);
    return match ?? providers[0];
  }, [providers, selectedId]);

  const selectedModel = useMemo(() => {
    const stored = modelSelections[selectedProvider.id];
    if (stored && selectedProvider.models.includes(stored)) {
      return stored;
    }
    return selectedProvider.defaultModel;
  }, [modelSelections, selectedProvider]);

  const setApiKey = useCallback<ProviderContextValue["setApiKey"]>((providerId, key) => {
    const sanitized = key.trim();
    setApiKeys((prev) => {
      const next = { ...prev } as Record<ProviderId, string>;
      if (!sanitized) {
        delete next[providerId];
      } else {
        next[providerId] = sanitized;
      }
      localStorage.setItem(STORAGE_KEYS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const selectProvider = useCallback<ProviderContextValue["selectProvider"]>((providerId) => {
    setSelectedId(providerId);
    localStorage.setItem(STORAGE_SELECTED_KEY, JSON.stringify(providerId));
  }, []);

  const setModel = useCallback<ProviderContextValue["setModel"]>((providerId, model) => {
    setModelSelections((prev) => {
      const next = { ...prev, [providerId]: model } as Record<ProviderId, string>;
      localStorage.setItem(STORAGE_MODEL_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const registerCustomProvider = useCallback<ProviderContextValue["registerCustomProvider"]>((input) => {
    const descriptor: ProviderDescriptor = {
      id: `custom:${generateId("prov")}`,
      label: input.label,
      models: input.models ?? ["text-generation"],
      docsUrl: input.docsUrl ?? "",
      defaultModel: input.models?.[0] ?? "text-generation",
      type: "chat",
    };

    setCustomProviders((prev) => {
      const next = [...prev, descriptor];
      localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(next));
      return next;
    });

    setModel(descriptor.id, descriptor.defaultModel);
    return descriptor;
  }, [setModel]);

  const value = useMemo<ProviderContextValue>(
    () => ({
      providers,
      selectedProvider,
      selectedModel,
      apiKeys,
      modelSelections,
      setApiKey,
      selectProvider,
      setModel,
      registerCustomProvider,
    }),
    [providers, selectedProvider, selectedModel, apiKeys, modelSelections, setApiKey, selectProvider, setModel, registerCustomProvider]
  );

  return <ProviderRegistryContext.Provider value={value}>{children}</ProviderRegistryContext.Provider>;
}

export function useProviderRegistry() {
  const ctx = useContext(ProviderRegistryContext);
  if (!ctx) {
    throw new Error("useProviderRegistry must be used within ProviderRegistryProvider");
  }
  return ctx;
}

