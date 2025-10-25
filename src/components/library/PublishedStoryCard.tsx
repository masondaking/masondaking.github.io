import { motion } from "framer-motion";
import { ArrowRight, Heart, Star, Trash2, UserCheck, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { PublishedStory } from "../../context/LibraryContext";
import { useAuth } from "../../context/AuthContext";
import { useLibrary } from "../../context/LibraryContext";

interface PublishedStoryCardProps {
  story: PublishedStory;
  averageRating: number;
}

export function PublishedStoryCard({ story, averageRating }: PublishedStoryCardProps) {
  const { user, toggleSubscription } = useAuth();
  const { deleteStory, toggleStoryLike } = useLibrary();
  const reviewCount = story.reviews.length;
  const likeCount = story.likeUserIds?.length ?? 0;
  const isLiked = user ? story.likeUserIds?.includes(user.id) ?? false : false;
  const canSubscribe = !!user && user.id !== story.authorId;
  const isSubscribed = !!user?.subscriptions?.includes(story.authorId);

  const handleDelete = () => {
    if (!user?.isDev) return;
    const ok = window.confirm("Delete this story? This cannot be undone.");
    if (ok) deleteStory(story.id);
  };

  const handleToggleLike = () => {
    if (!user) {
      window.alert("Log in or create an account to like stories and lift them to the top.");
      return;
    }
    toggleStoryLike(story.id, user.id);
  };

  const handleToggleSubscription = () => {
    if (!user) {
      window.alert("Create an account to follow your favourite storytellers.");
      return;
    }
    toggleSubscription(story.authorId);
  };

  return (
    <motion.article
      className="glass-card published-story-card"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.4 }}
    >
      <header>
        <h3>{story.metadata.title}</h3>
        <p>{story.summary}</p>
      </header>
      <ul className="story-tag-list">
        {[story.metadata.genre, story.metadata.tone, story.metadata.perspective]
          .filter(Boolean)
          .slice(0, 3)
          .map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        {story.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <footer>
        <div className="story-card-insights">
          <div className="story-card-meta">
            <span>{new Date(story.publishedAt).toLocaleDateString()}</span>
            <span className="story-rating">
            <Star size={14} /> {averageRating.toFixed(1)} ({reviewCount})
            </span>
          </div>
          <button
            type="button"
            className={`ghost-button story-like-button${isLiked ? " is-liked" : ""}`}
            onClick={handleToggleLike}
            aria-pressed={isLiked}
            title={isLiked ? "Unlike this story" : "Like this story"}
          >
            <Heart size={14} />
            <span>{likeCount}</span>
          </button>
        </div>
        <div className="story-card-actions">
          {canSubscribe && (
            <button
              type="button"
              className={`ghost-button story-subscribe-button${isSubscribed ? " is-subscribed" : ""}`}
              onClick={handleToggleSubscription}
              aria-pressed={isSubscribed}
              title={isSubscribed ? "Unfollow author" : "Follow this author"}
            >
              {isSubscribed ? <UserCheck size={14} /> : <UserPlus size={14} />}
              <span>{isSubscribed ? "Following" : "Follow author"}</span>
            </button>
          )}
          <Link to={`/stories/${story.id}`} className="ghost-button">
            Read story <ArrowRight size={14} />
          </Link>
          {user?.isDev && (
            <button type="button" className="ghost-button" onClick={handleDelete} title="Delete story">
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </footer>
    </motion.article>
  );
}
