import { createContext, ReactNode, useCallback, useContext, useMemo, useReducer } from "react";
import { generateId } from "../utils/crypto";

export interface FeedbackMessage {
  id: string;
  message: string;
  promptLabel?: string;
  authorName?: string;
  createdAt: string;
  reply?: {
    text: string;
    createdAt: string;
  };
}

interface FeedbackState {
  messages: FeedbackMessage[];
}

interface FeedbackContextValue {
  messages: FeedbackMessage[];
  submitMessage: (input: { message: string; promptLabel?: string; authorName?: string }) => FeedbackMessage;
  replyToMessage: (id: string, text: string) => void;
}

const STORAGE_KEY = "sf:feedback";

function loadInitialState(): FeedbackState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw) as FeedbackMessage[];
    return { messages: parsed };
  } catch {
    return { messages: [] };
  }
}

function persist(state: FeedbackState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages));
}

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

type Action =
  | { type: "submit"; message: FeedbackMessage }
  | { type: "reply"; id: string; text: string; createdAt: string };

function reducer(state: FeedbackState, action: Action): FeedbackState {
  switch (action.type) {
    case "submit": {
      const messages = [action.message, ...state.messages].slice(0, 200);
      const next = { messages };
      persist(next);
      return next;
    }
    case "reply": {
      const messages = state.messages.map((message) =>
        message.id === action.id
          ? { ...message, reply: { text: action.text, createdAt: action.createdAt } }
          : message
      );
      const next = { messages };
      persist(next);
      return next;
    }
    default:
      return state;
  }
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  const submitMessage = useCallback<FeedbackContextValue["submitMessage"]>((input) => {
    const message: FeedbackMessage = {
      id: generateId("fbk"),
      message: input.message,
      promptLabel: input.promptLabel,
      authorName: input.authorName,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "submit", message });
    return message;
  }, []);

  const replyToMessage = useCallback<FeedbackContextValue["replyToMessage"]>((id, text) => {
    dispatch({ type: "reply", id, text, createdAt: new Date().toISOString() });
  }, []);

  const value = useMemo<FeedbackContextValue>(() => ({ messages: state.messages, submitMessage, replyToMessage }), [state.messages, submitMessage, replyToMessage]);

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }
  return ctx;
}
