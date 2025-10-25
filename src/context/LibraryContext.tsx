import { createContext, ReactNode, useCallback, useContext, useMemo, useReducer } from "react";
import { StoryMetadata } from "./WorkspaceContext";
import { generateId } from "../utils/crypto";
import { useModeration } from "./ModerationContext";
import { useAuth } from "./AuthContext";

export interface StoryReview {
  id: string;
  storyId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface PublishedStory {
  id: string;
  authorId: string;
  authorName: string;
  metadata: StoryMetadata;
  content: string;
  summary: string;
  tags: string[];
  publishedAt: string;
  reviews: StoryReview[];
  coverImage?: string;
  coverGallery?: string[];
  coverStyle?: string;
  likeUserIds: string[];
}

interface LibraryState {
  stories: PublishedStory[];
}

interface PublishInput {
  authorId: string;
  authorName: string;
  metadata: StoryMetadata;
  content: string;
  summary: string;
  tags: string[];
  coverImage?: string;
  coverGallery?: string[];
  coverStyle?: string;
}

interface ReviewInput {
  storyId: string;
  reviewerName: string;
  rating: number;
  comment: string;
}

interface LibraryContextValue {
  stories: PublishedStory[];
  publishStory: (input: PublishInput) => PublishedStory;
  addReview: (input: ReviewInput) => StoryReview;
  getStoryById: (storyId: string) => PublishedStory | undefined;
  deleteStory: (storyId: string) => void;
  deleteReview: (reviewId: string) => void;
  toggleStoryLike: (storyId: string, userId: string) => boolean;
  getRandomStory: (excludeId?: string) => PublishedStory | undefined;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

const STORAGE_KEY = "sf:published-stories";

function loadInitialState(): LibraryState {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { stories: [] };
  }

  try {
    const rawStories = JSON.parse(stored) as Array<PublishedStory & { ttsConfig?: unknown; likeUserIds?: string[] }>;
    const stories = rawStories.map(({ ttsConfig, reviews, ...story }) => ({
      ...story,
      reviews: reviews ?? [],
      coverGallery: story.coverGallery ?? (story.coverImage ? [story.coverImage] : []),
      likeUserIds: story.likeUserIds ?? [],
    }));
    return { stories };
  } catch (error) {
    console.error("Failed to parse published stories", error);
    return { stories: [] };
  }
}

function persist(state: LibraryState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stories));
}

type Action =
  | { type: "publish"; story: PublishedStory }
  | { type: "review"; storyId: string; review: StoryReview }
  | { type: "delete"; storyId: string }
  | { type: "review_delete"; reviewId: string }
  | { type: "toggle_like"; storyId: string; userId: string };

function reducer(state: LibraryState, action: Action): LibraryState {
  switch (action.type) {
    case "publish": {
      const stories = [action.story, ...state.stories];
      const next = { stories };
      persist(next);
      return next;
    }
    case "review": {
      const stories = state.stories.map((story) =>
        story.id === action.storyId ? { ...story, reviews: [action.review, ...story.reviews] } : story
      );
      const next = { stories };
      persist(next);
      return next;
    }
    case "delete": {
      const stories = state.stories.filter((story) => story.id !== action.storyId);
      const next = { stories };
      persist(next);
      return next;
    }
    case "review_delete": {
      const stories = state.stories.map((story) => ({
        ...story,
        reviews: story.reviews.filter((r) => r.id !== action.reviewId),
      }));
      const next = { stories };
      persist(next);
      return next;
    }
    case "toggle_like": {
      const stories = state.stories.map((story) => {
        if (story.id !== action.storyId) return story;
        const current = new Set(story.likeUserIds ?? []);
        if (current.has(action.userId)) {
          current.delete(action.userId);
        } else {
          current.add(action.userId);
        }
        return { ...story, likeUserIds: Array.from(current) };
      });
      const next = { stories };
      persist(next);
      return next;
    }
    default:
      return state;
  }
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const { validateText, recordLog } = useModeration();
  const { user } = useAuth();
  const isModerator = !!(user?.isDev || user?.roleId === "mod" || user?.roleId === "staff");

  const publishStory: LibraryContextValue["publishStory"] = useCallback((input) => {
    // Moderators and devs bypass automod
    if (!isModerator) {
      const fields = [input.content, input.summary, input.metadata.title, input.tags.join(" ")];
      for (const f of fields) {
        const res = validateText(f);
        if (!res.ok) {
          recordLog({ type: "blocked_content", details: `publish blocked on word: ${res.word}` });
          throw new Error("Story contains blocked terms. Please edit and try again.");
        }
      }
    }
    const story: PublishedStory = {
      id: generateId("story"),
      authorId: input.authorId,
      authorName: input.authorName,
      metadata: input.metadata,
      content: input.content,
      summary: input.summary,
      tags: input.tags,
      publishedAt: new Date().toISOString(),
      reviews: [],
      coverImage: input.coverImage,
      coverGallery: input.coverGallery ?? (input.coverImage ? [input.coverImage] : []),
      coverStyle: input.coverStyle,
      likeUserIds: [],
    };
    dispatch({ type: "publish", story });
    return story;
  }, [recordLog, validateText, isModerator]);

  const addReview: LibraryContextValue["addReview"] = useCallback((input) => {
    if (!isModerator) {
      const res = validateText(input.comment);
      if (!res.ok) {
        recordLog({ type: "blocked_content", details: `review blocked on word: ${res.word}`, targetResourceId: input.storyId });
        throw new Error("Review contains blocked terms.");
      }
    }
    const review: StoryReview = {
      id: generateId("rev"),
      storyId: input.storyId,
      reviewerName: input.reviewerName,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "review", storyId: input.storyId, review });
    return review;
  }, [recordLog, validateText, isModerator]);

  const getStoryById = useCallback<LibraryContextValue["getStoryById"]>(
    (storyId) => state.stories.find((story) => story.id === storyId),
    [state.stories]
  );

  const deleteStory: LibraryContextValue["deleteStory"] = useCallback((storyId: string) => {
    dispatch({ type: "delete", storyId });
  }, []);

  const deleteReview: LibraryContextValue["deleteReview"] = useCallback((reviewId: string) => {
    dispatch({ type: "review_delete", reviewId });
  }, []);

  const toggleStoryLike: LibraryContextValue["toggleStoryLike"] = useCallback(
    (storyId, userId) => {
      const story = state.stories.find((entry) => entry.id === storyId);
      if (!story) return false;
      const hasLiked = story.likeUserIds?.includes(userId) ?? false;
      dispatch({ type: "toggle_like", storyId, userId });
      return !hasLiked;
    },
    [state.stories]
  );

  const getRandomStory: LibraryContextValue["getRandomStory"] = useCallback(
    (excludeId) => {
      const pool = excludeId ? state.stories.filter((story) => story.id !== excludeId) : state.stories;
      if (pool.length === 0) return undefined;
      const index = Math.floor(Math.random() * pool.length);
      return pool[index];
    },
    [state.stories]
  );

  const value = useMemo(
    () => ({
      stories: state.stories,
      publishStory,
      addReview,
      getStoryById,
      deleteStory,
      deleteReview,
      toggleStoryLike,
      getRandomStory,
    }),
    [state.stories, publishStory, addReview, getStoryById, deleteStory, deleteReview, toggleStoryLike, getRandomStory]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) {
    throw new Error("useLibrary must be used within a LibraryProvider");
  }
  return ctx;
}
