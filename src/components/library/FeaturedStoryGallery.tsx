import { motion } from "framer-motion";
import { ArrowRight, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { PublishedStory } from "../../context/LibraryContext";

const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #1d976c, #93f9b9)",
  "linear-gradient(135deg, #654ea3, #eaafc8)",
  "linear-gradient(135deg, #ff512f, #dd2476)",
  "linear-gradient(135deg, #3a7bd5, #3a6073)",
];

interface FeaturedStoryGalleryProps {
  stories: PublishedStory[];
}

export function FeaturedStoryGallery({ stories }: FeaturedStoryGalleryProps) {
  if (!stories.length) return null;

  return (
    <div className="featured-gallery">
      {stories.map((story, index) => {
        const cover = story.coverGallery?.[0] ?? story.coverImage;
        const likeCount = story.likeUserIds?.length ?? 0;
        const baseSnippet = story.summary?.trim() || story.content.split(/\n+/).find(Boolean) || "";
        const snippet = baseSnippet
          ? `${baseSnippet.slice(0, 160)}${baseSnippet.length > 160 ? "…" : ""}`
          : "";
        const background = cover
          ? `linear-gradient(135deg, rgba(10, 8, 30, 0.12), rgba(10, 8, 30, 0.68)), url("${cover}")`
          : FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length];

        return (
          <motion.article
            key={story.id}
            className="featured-gallery__card"
            style={{ backgroundImage: background }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6, scale: 1.01 }}
            transition={{ duration: 0.45 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="featured-gallery__overlay">
              <span className="featured-gallery__eyebrow">#{index + 1} spotlight</span>
              <h3>{story.metadata.title}</h3>
              {snippet && <p>{snippet}</p>}
              <div className="featured-gallery__meta">
                <span>By {story.authorName}</span>
                <span>
                  <Heart size={14} /> {likeCount}
                </span>
              </div>
              <ul className="featured-gallery__tags">
                {[story.metadata.genre, story.metadata.tone]
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                {story.tags.slice(0, 2).map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
              <Link to={`/stories/${story.id}`} className="ghost-button featured-gallery__cta">
                Read now <ArrowRight size={14} />
              </Link>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
