import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLibrary } from "../../context/LibraryContext";
import { useAchievements } from "../../context/AchievementsContext";
import { useAuth } from "../../context/AuthContext";
import { PublishedStoryCard } from "../../components/library/PublishedStoryCard";
import { Shuffle } from "lucide-react";
import { FeaturedStoryGallery } from "../../components/library/FeaturedStoryGallery";

function averageRating(total: number, count: number) {
  if (count === 0) return total;
  return total / count;
}

export function LibraryPage() {
  const { stories, getRandomStory } = useLibrary();
  const { achievements, collections, createCollection, stats } = useAchievements();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionMessage, setCollectionMessage] = useState<string | null>(null);

  const orderedStories = useMemo(() => {
    return stories
      .slice()
      .sort((a, b) => {
        const likeDiff = (b.likeUserIds?.length ?? 0) - (a.likeUserIds?.length ?? 0);
        if (likeDiff !== 0) return likeDiff;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
  }, [stories]);

  const featuredStories = useMemo(() => orderedStories.slice(0, 4), [orderedStories]);

  const cards = useMemo(
    () =>
      orderedStories.map((story) => {
        const totals = story.reviews.reduce(
          (acc, review) => {
            acc.total += review.rating;
            return acc;
          },
          { total: 0 }
        );
        const avg = story.reviews.length ? averageRating(totals.total, story.reviews.length) : 0;
        return { story, avg };
      }),
    [orderedStories]
  );

  const handleCreateCollection = () => {
    setCollectionMessage(null);
    if (!user) {
      setCollectionMessage("Log in to create collections.");
      return;
    }
    if (!newCollectionName.trim()) {
      setCollectionMessage("Choose a name before creating a collection.");
      return;
    }
    const created = createCollection(newCollectionName.trim());
    if (created) {
      setNewCollectionName("");
      setCollectionMessage(`Collection "${created.name}" is ready for stories.`);
    }
  };

  const handleRandomStory = () => {
    const selection = getRandomStory();
    if (!selection) {
      window.alert("No published stories yet. Be the first to contribute!");
      return;
    }
    navigate(`/stories/${selection.id}`);
  };

  return (
    <div className="library-page">
      <section className="library-hero">
        <motion.div
          className="library-hero__content"
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="library-hero__eyebrow">Community bookshelf</span>
          <h1>Published stories from Dreamscribe writers</h1>
          <p>
            Explore narratives crafted with multi-model collaboration. Rate your favorites, leave thoughtful feedback, and follow the creative process from prompt to polish.
          </p>
          <div className="library-hero__cta">
            <Link to="/studio" className="primary-button">
              Publish your own
            </Link>
            <a className="ghost-button" href="#stories">
              Browse collection
            </a>
            <button type="button" className="ghost-button" onClick={handleRandomStory} disabled={!stories.length}>
              <Shuffle size={16} /> Surprise me
            </button>
          </div>
        </motion.div>
        <motion.div
          className="library-hero__glow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        />
      </section>

      {featuredStories.length > 0 && (
        <section className="section-shell library-featured" id="spotlight">
          <header className="library-section__header">
            <div>
              <h2>Spotlight stories</h2>
              <p>The most loved tales rise here �?" powered by reader likes.</p>
            </div>
            <button type="button" className="ghost-button" onClick={handleRandomStory}>
              <Shuffle size={16} /> Random story
            </button>
          </header>
          <FeaturedStoryGallery stories={featuredStories} />
        </section>
      )}

      {user && (
        <section className="section-shell library-dashboard">
          <div className="library-dashboard__column">
            <h2>Your achievements</h2>
            <p className="library-dashboard__meta">
              Published {stats.publishedStoryIds.length} story{stats.publishedStoryIds.length === 1 ? "" : "ies"},
              received {stats.reviewsReceived} review{stats.reviewsReceived === 1 ? "" : "s"},
              wrote {stats.reviewsWritten} review{stats.reviewsWritten === 1 ? "" : "s"}.
            </p>
            {achievements.length ? (
              <ul className="achievement-list">
                {achievements
                  .slice()
                  .sort((a, b) => (a.unlockedAt < b.unlockedAt ? 1 : -1))
                  .map((achievement) => (
                    <li key={achievement.id}>
                      <strong>{achievement.title}</strong>
                      <span>{achievement.description}</span>
                      <time>{new Date(achievement.unlockedAt).toLocaleDateString()}</time>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="studio-output__placeholder">
                Unlock your first badge by publishing a story or leaving a review.
              </p>
            )}
          </div>
          <div className="library-dashboard__column">
            <h2>Your collections</h2>
            <div className="library-dashboard__actions">
              <input
                type="text"
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder="New collection name"
              />
              <button type="button" className="ghost-button" onClick={handleCreateCollection}>
                Create
              </button>
            </div>
            {collectionMessage && <div className="notice notice--muted">{collectionMessage}</div>}
            {collections.length ? (
              <ul className="collection-list">
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <div>
                      <strong>{collection.name}</strong>
                      <span>{collection.stories.length} story{collection.stories.length === 1 ? "" : "ies"}</span>
                    </div>
                    {collection.stories.length > 0 && (
                      <div className="collection-list__stories">
                        {collection.stories.slice(0, 3).map((story) => (
                          <span key={story.id}>{story.title}</span>
                        ))}
                        {collection.stories.length > 3 && <span>+{collection.stories.length - 3} more</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="studio-output__placeholder">
                Organize your favourite reads by creating a collection.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="section-shell" id="stories">
        <header className="library-section__header">
          <h2>Trending now</h2>
          <p>Stories float to the top as likes pour in. Discover what the community is rallying behind.</p>
        </header>
        <div className="library-grid">
          {cards.length === 0 ? (
            <p className="studio-output__placeholder">
              No stories have been published yet. Share yours from the studio once you are ready!
            </p>
          ) : (
            cards.map(({ story, avg }) => <PublishedStoryCard key={story.id} story={story} averageRating={avg} />)
          )}
        </div>
      </section>
    </div>
  );
}
