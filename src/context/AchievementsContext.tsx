import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { PublishedStory } from "./LibraryContext";
import { generateId } from "../utils/crypto";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedAt: string;
}

export interface CollectionStory {
  id: string;
  title: string;
  authorName: string;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
  stories: CollectionStory[];
}

interface AchievementStats {
  publishedStoryIds: string[];
  publishedGenres: string[];
  reviewsWritten: number;
  reviewsReceived: number;
}

interface AchievementState {
  achievements: Achievement[];
  collections: Collection[];
  stats: AchievementStats;
}

interface AchievementsContextValue {
  achievements: Achievement[];
  collections: Collection[];
  stats: AchievementStats;
  createCollection: (name: string) => Collection | null;
  removeCollection: (collectionId: string) => void;
  addStoryToCollection: (collectionId: string, story: CollectionStory) => void;
  removeStoryFromCollection: (collectionId: string, storyId: string) => void;
  recordStoryPublished: (story: PublishedStory) => void;
  recordReviewWritten: (storyId: string) => void;
  recordReviewReceived: (storyId: string) => void;
}

const AchievementsContext = createContext<AchievementsContextValue | undefined>(undefined);

const STORAGE_KEY = "sf:achievements";

const defaultStats: AchievementStats = {
  publishedStoryIds: [],
  publishedGenres: [],
  reviewsWritten: 0,
  reviewsReceived: 0,
};

type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  check: (stats: AchievementStats, collections: Collection[]) => boolean;
};

const baseAchievements: AchievementDefinition[] = [
  {
    id: "story-starter",
    title: "Story Starter",
    description: "Publish your first story.",
    check: (stats, _collections) => stats.publishedStoryIds.length >= 1,
  },
  {
    id: "prolific-author",
    title: "Prolific Author",
    description: "Publish five stories.",
    check: (stats, _collections) => stats.publishedStoryIds.length >= 5,
  },
  {
    id: "genre-explorer",
    title: "Genre Explorer",
    description: "Publish stories across three different genres.",
    check: (stats, _collections) => [...new Set(stats.publishedGenres)].length >= 3,
  },
  {
    id: "thoughtful-critic",
    title: "Thoughtful Critic",
    description: "Leave your first review.",
    check: (stats, _collections) => stats.reviewsWritten >= 1,
  },
  {
    id: "community-favorite",
    title: "Community Favorite",
    description: "Receive five reviews across your stories.",
    check: (stats, _collections) => stats.reviewsReceived >= 5,
  },
  {
    id: "curator",
    title: "Curator",
    description: "Create your first collection.",
    check: (_: AchievementStats, collections: Collection[]) => collections.length >= 1,
  },
] as const;

function loadState(): Record<string, AchievementState> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, AchievementState>;
  } catch (error) {
    console.error("Failed to parse achievements store", error);
    return {};
  }
}

function persistState(state: Record<string, AchievementState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureState(state: AchievementState | undefined): AchievementState {
  if (!state) {
    return {
      achievements: [],
      collections: [],
      stats: { ...defaultStats },
    };
  }
  return {
    achievements: state.achievements ?? [],
    collections: state.collections ?? [],
    stats: {
      publishedStoryIds: state.stats?.publishedStoryIds ?? [],
      publishedGenres: state.stats?.publishedGenres ?? [],
      reviewsWritten: state.stats?.reviewsWritten ?? 0,
      reviewsReceived: state.stats?.reviewsReceived ?? 0,
    },
  };
}

export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [store, setStore] = useState<Record<string, AchievementState>>(() => loadState());

  const activeState = useMemo(() => {
    if (!user) return ensureState(undefined);
    return ensureState(store[user.id]);
  }, [store, user]);

  const updateForUser = useCallback(
    (updater: (current: AchievementState) => AchievementState) => {
      if (!user) return;
      setStore((prev) => {
        const next = { ...prev };
        const current = ensureState(prev[user.id]);
        next[user.id] = updater(current);
        persistState(next);
        return next;
      });
    },
    [user]
  );

  const evaluateAchievements = useCallback((state: AchievementState) => {
    const unlockedIds = new Set(state.achievements.map((achievement) => achievement.id));
    const additions: Achievement[] = [];

    baseAchievements.forEach((definition) => {
      if (unlockedIds.has(definition.id)) return;
      const achieved = definition.check(state.stats, state.collections);

      if (achieved) {
        additions.push({
          id: definition.id,
          title: definition.title,
          description: definition.description,
          unlockedAt: new Date().toISOString(),
        });
      }
    });

    if (additions.length === 0) {
      return state;
    }

    return {
      ...state,
      achievements: [...state.achievements, ...additions],
    };
  }, []);

  const recordStoryPublished = useCallback(
    (story: PublishedStory) => {
      updateForUser((current) => {
        const stats: AchievementStats = {
          ...current.stats,
          publishedStoryIds: Array.from(new Set([...current.stats.publishedStoryIds, story.id])),
          publishedGenres: Array.from(new Set([...current.stats.publishedGenres, story.metadata.genre])),
        };

        const nextState = evaluateAchievements({
          ...current,
          stats,
        });

        return { ...nextState, stats };
      });
    },
    [updateForUser, evaluateAchievements]
  );

  const recordReviewWritten = useCallback(
    (_storyId: string) => {
      updateForUser((current) => {
        const stats: AchievementStats = {
          ...current.stats,
          reviewsWritten: current.stats.reviewsWritten + 1,
        };
        const nextState = evaluateAchievements({ ...current, stats });
        return { ...nextState, stats };
      });
    },
    [updateForUser, evaluateAchievements]
  );

  const recordReviewReceived = useCallback(
    (_storyId: string) => {
      updateForUser((current) => {
        const stats: AchievementStats = {
          ...current.stats,
          reviewsReceived: current.stats.reviewsReceived + 1,
        };
        const nextState = evaluateAchievements({ ...current, stats });
        return { ...nextState, stats };
      });
    },
    [updateForUser, evaluateAchievements]
  );

  const createCollection = useCallback<AchievementsContextValue["createCollection"]>(
    (name) => {
      if (!name.trim()) return null;
      let created: Collection | null = null;
      updateForUser((current) => {
        const collection: Collection = {
          id: generateId("col"),
          name: name.trim(),
          createdAt: new Date().toISOString(),
          stories: [],
        };
        created = collection;
        const nextState = evaluateAchievements({
          ...current,
          collections: [collection, ...current.collections],
        });
        return { ...nextState };
      });
      return created;
    },
    [updateForUser, evaluateAchievements]
  );

  const removeCollection = useCallback<AchievementsContextValue["removeCollection"]>(
    (collectionId) => {
      updateForUser((current) => ({
        ...current,
        collections: current.collections.filter((collection) => collection.id !== collectionId),
      }));
    },
    [updateForUser]
  );

  const addStoryToCollection = useCallback<AchievementsContextValue["addStoryToCollection"]>(
    (collectionId, story) => {
      updateForUser((current) => {
        const collections = current.collections.map((collection) => {
          if (collection.id !== collectionId) return collection;
          const exists = collection.stories.some((item) => item.id === story.id);
          if (exists) return collection;
          return {
            ...collection,
            stories: [{ ...story }, ...collection.stories].slice(0, 50),
          };
        });
        return { ...current, collections };
      });
    },
    [updateForUser]
  );

  const removeStoryFromCollection = useCallback<AchievementsContextValue["removeStoryFromCollection"]>(
    (collectionId, storyId) => {
      updateForUser((current) => {
        const collections = current.collections.map((collection) =>
          collection.id === collectionId
            ? { ...collection, stories: collection.stories.filter((story) => story.id !== storyId) }
            : collection
        );
        return { ...current, collections };
      });
    },
    [updateForUser]
  );

  useEffect(() => {
    persistState(store);
  }, [store]);

  const value = useMemo<AchievementsContextValue>(
    () => ({
      achievements: user ? activeState.achievements : [],
      collections: user ? activeState.collections : [],
      stats: user ? activeState.stats : { ...defaultStats },
      createCollection,
      removeCollection,
      addStoryToCollection,
      removeStoryFromCollection,
      recordStoryPublished,
      recordReviewWritten,
      recordReviewReceived,
    }),
    [activeState, user, createCollection, removeCollection, addStoryToCollection, removeStoryFromCollection, recordStoryPublished, recordReviewWritten, recordReviewReceived]
  );

  return <AchievementsContext.Provider value={value}>{children}</AchievementsContext.Provider>;
}

export function useAchievements() {
  const context = useContext(AchievementsContext);
  if (!context) {
    throw new Error("useAchievements must be used within an AchievementsProvider");
  }
  return context;
}
