import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trash2, Volume2, Square, Heart, UserPlus, UserCheck, Shuffle } from "lucide-react";
import { useLibrary } from "../../context/LibraryContext";
import { useModeration } from "../../context/ModerationContext";
import { useAuth } from "../../context/AuthContext";
import { useAchievements } from "../../context/AchievementsContext";
import { RatingStars } from "../../components/ui/RatingStars";
import { ReviewList } from "../../components/library/ReviewList";

export function StoryDetailPage() {
  const params = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { getStoryById, addReview, deleteStory, deleteReview, toggleStoryLike, getRandomStory } = useLibrary();
  const { recordLog } = useModeration();
  const story = params.storyId ? getStoryById(params.storyId) : undefined;
  const { user, toggleSubscription } = useAuth();
  const {
    collections,
    createCollection,
    addStoryToCollection,
    removeStoryFromCollection,
    recordReviewWritten,
    recordReviewReceived,
  } = useAchievements();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [collectionFeedback, setCollectionFeedback] = useState<string | null>(null);
  const [activeCoverIndex, setActiveCoverIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const likeCount = story?.likeUserIds?.length ?? 0;
  const isLiked = story && user ? story.likeUserIds?.includes(user.id) ?? false : false;
  const canSubscribe = !!(story && user && user.id !== story.authorId);
  const isSubscribed = !!(story && user?.subscriptions?.includes(story.authorId));

  const ratingAverage = useMemo(() => {
    if (!story || story.reviews.length === 0) return 0;
    const total = story.reviews.reduce((acc, review) => acc + review.rating, 0);
    return total / story.reviews.length;
  }, [story]);

  const previewSnippet = useMemo(() => {
    if (!story) return "";
    if (story.summary?.trim()) {
      return story.summary.trim().slice(0, 400);
    }
    const firstParagraph = story.content.split(/\n\n+/).find(Boolean) ?? story.content;
    return firstParagraph.slice(0, 400);
  }, [story]);

  useEffect(() => {
    if (!user) {
      setSelectedCollectionId("");
      return;
    }
    if (collections.length === 0) {
      setSelectedCollectionId("");
      return;
    }
    if (!collections.some((collection) => collection.id === selectedCollectionId)) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, user, selectedCollectionId]);

  useEffect(() => {
    setActiveCoverIndex(0);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [story?.id]);

  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const storyCollections = useMemo(
    () => collections.filter((collection) => collection.stories.some((entry) => entry.id === story?.id)),
    [collections, story?.id]
  );

  if (!story) {
    return (
      <div className="section-shell">
        <button type="button" className="ghost-button" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <p className="studio-output__placeholder">Story not found.</p>
      </div>
    );
  }

  const cover = story.coverImage;
  const coverGallery = story.coverGallery ?? (cover ? [cover] : []);

  const handleDelete = () => {
    if (!user?.isDev) return;
    const confirmed = window.confirm("Delete this story? This cannot be undone.");
    if (!confirmed) return;
    deleteStory(story.id);
    navigate("/stories", { replace: true });
  };

  const handleReviewSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!comment.trim()) {
      setReviewError("Please share a few thoughts along with your rating.");
      return;
    }
    addReview({
      storyId: story.id,
      reviewerName: user?.displayName ?? "Guest Reader",
      rating,
      comment: comment.trim(),
    });
    if (user) {
      recordReviewWritten(story.id);
      if (story.authorId === user.id) {
        recordReviewReceived(story.id);
      }
    }
    setComment("");
    setReviewError(null);
  };

  const handleCreateCollection = () => {
    setCollectionFeedback(null);
    if (!user) {
      setCollectionFeedback("Log in to create collections.");
      return;
    }
    if (!newCollectionName.trim()) {
      setCollectionFeedback("Choose a name for your collection.");
      return;
    }
    const created = createCollection(newCollectionName.trim());
    if (created) {
      setSelectedCollectionId(created.id);
      setNewCollectionName("");
    setCollectionFeedback(`Collection "${created.name}" created.`);
    }
  };

  const handleToggleLike = () => {
    if (!story) return;
    if (!user) {
      window.alert("Log in to like stories. The most-loved tales rise to the top.");
      return;
    }
    toggleStoryLike(story.id, user.id);
  };

  const handleToggleSubscription = () => {
    if (!story || !user) {
      window.alert("Sign in to follow authors and get their new releases first.");
      return;
    }
    toggleSubscription(story.authorId);
  };

  const handleRandomStory = () => {
    if (!story) return;
    const suggestion = getRandomStory(story.id);
    if (!suggestion) {
      window.alert("No other published stories yet. Be the first to share one!");
      return;
    }
    navigate(`/stories/${suggestion.id}`);
  };

  const handleAddToCollection = () => {
    setCollectionFeedback(null);
    if (!user) {
      setCollectionFeedback("Log in to save stories to collections.");
      return;
    }
    if (!selectedCollectionId) {
      setCollectionFeedback("Create or select a collection first.");
      return;
    }
    addStoryToCollection(selectedCollectionId, {
      id: story.id,
      title: story.metadata.title,
      authorName: story.authorName,
    });
    setCollectionFeedback("Added to collection.");
  };

  const handleRemoveFromCollection = (collectionId: string) => {
    removeStoryFromCollection(collectionId, story.id);
  };

  const handleSpeak = () => {
    if (!previewSnippet) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }
    const synth = window.speechSynthesis;
    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(previewSnippet);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    synth.cancel();
    synth.speak(utterance);
    utteranceRef.current = utterance;
    setIsSpeaking(true);
  };

  return (
    <div className="story-detail">
      <section className="section-shell story-detail__header">
        <div className="story-detail__header-actions">
          <button type="button" className="ghost-button" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
          {user?.isDev && (
            <button type="button" className="ghost-button" onClick={handleDelete} title="Delete story">
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>

        {coverGallery.length > 0 && (
          <div className="story-cover-gallery">
            <img src={coverGallery[activeCoverIndex]} alt="Story cover" />
            {coverGallery.length > 1 && (
              <div className="story-cover-gallery__thumbs">
                {coverGallery.map((src, index) => (
                  <button
                    key={index}
                    type="button"
                    className={index === activeCoverIndex ? "cover-thumb-button cover-thumb-button--active" : "cover-thumb-button"}
                    onClick={() => setActiveCoverIndex(index)}
                  >
                    <img src={src} alt={`Cover variant ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <span className="story-detail__meta">By {story.authorName}</span>
          <h1>{story.metadata.title}</h1>
          <div className="story-detail__tags">
            <span>{story.metadata.genre}</span>
            <span>{story.metadata.tone}</span>
            <span>{story.metadata.targetLength}</span>
          </div>
          <div className="story-detail__ratings">
            <RatingStars value={Math.round(ratingAverage)} readOnly />
            <span>
              {ratingAverage ? ratingAverage.toFixed(1) : "No reviews yet"} | {story.reviews.length} review
              {story.reviews.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="story-detail__summary">{story.summary}</p>
          {previewSnippet && (
            <div className="story-detail__actions">
              <button type="button" className="ghost-button" onClick={handleSpeak}>
                {isSpeaking ? <Square size={16} /> : <Volume2 size={16} />} {isSpeaking ? "Stop preview" : "Play preview"}
              </button>
              <button
                type="button"
                className={`ghost-button story-detail__like${isLiked ? " is-liked" : ""}`}
                onClick={handleToggleLike}
                aria-pressed={isLiked}
              >
                <Heart size={16} /> {likeCount} like{likeCount === 1 ? "" : "s"}
              </button>
              {canSubscribe && (
                <button
                  type="button"
                  className={`ghost-button story-detail__subscribe${isSubscribed ? " is-subscribed" : ""}`}
                  onClick={handleToggleSubscription}
                  aria-pressed={isSubscribed}
                >
                  {isSubscribed ? <UserCheck size={16} /> : <UserPlus size={16} />}{" "}
                  {isSubscribed ? "Following author" : "Follow author"}
                </button>
              )}
              <button type="button" className="ghost-button" onClick={handleRandomStory}>
                <Shuffle size={16} /> Surprise me
              </button>
            </div>
          )}
        </motion.div>
      </section>

      <section className="section-shell story-detail__content">
        <motion.article initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <pre>{story.content}</pre>
        </motion.article>
        <aside className="story-detail__aside">
          <div className="story-detail__info">
            <h2>Story snapshot</h2>
            <p className="story-detail__info-text">
              Keep readers oriented with the essentials — genre, tone, perspective, and the tags you set when publishing.
            </p>
            <ul className="story-detail__info-list">
              <li>
                <span>Published</span>
                <strong>{new Date(story.publishedAt).toLocaleString()}</strong>
              </li>
              <li>
                <span>Perspective</span>
                <strong>{story.metadata.perspective}</strong>
              </li>
              <li>
                <span>Tags</span>
                <div className="story-detail__tag-chips">
                  {story.tags.length ? story.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>#fiction</span>}
                </div>
              </li>
            </ul>
          </div>

          <div className="story-collections-card">
            <h2>Collections</h2>
            <div className="story-collections-actions">
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
            <div className="story-collections-actions">
              <select
                value={selectedCollectionId}
                onChange={(event) => setSelectedCollectionId(event.target.value)}
                disabled={!collections.length}
              >
                {collections.length === 0 ? (
                  <option value="">No collections yet</option>
                ) : (
                  collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))
                )}
              </select>
              <button type="button" className="ghost-button" onClick={handleAddToCollection}>
                Save story
              </button>
            </div>
            {collectionFeedback && <div className="notice notice--muted">{collectionFeedback}</div>}
            {storyCollections.length > 0 ? (
              <ul className="story-collections-list">
                {storyCollections.map((collection) => (
                  <li key={collection.id}>
                    <span>{collection.name}</span>
                    <button type="button" onClick={() => handleRemoveFromCollection(collection.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="story-detail__info-text">This story hasn't been saved to any of your collections yet.</p>
            )}
          </div>
        </aside>
      </section>

      <section className="section-shell story-detail__reviews">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <h2>Community reviews</h2>
          <ReviewList
            reviews={story.reviews}
            canModerate={!!user?.isDev}
            onDelete={(id) => {
              deleteReview(id);
              recordLog({ type: "delete_review", targetResourceId: id, details: `from story: ${story.id}` });
            }}
          />
        </motion.div>
        <motion.form
          className="review-form"
          onSubmit={handleReviewSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45 }}
        >
          <h3>Leave your feedback</h3>
          <RatingStars value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share what resonated, scenes you loved, or ways to improve."
            rows={4}
          />
          {reviewError && <div className="notice notice--error">{reviewError}</div>}
          <button type="submit" className="primary-button">
            Post review
          </button>
        </motion.form>
      </section>
    </div>
  );
}
