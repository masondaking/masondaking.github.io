import { StoryReview } from "../../context/LibraryContext";
import { RatingStars } from "../ui/RatingStars";

interface ReviewListProps {
  reviews: StoryReview[];
  canModerate?: boolean;
  onDelete?: (reviewId: string) => void;
}

export function ReviewList({ reviews, canModerate = false, onDelete }: ReviewListProps) {
  if (reviews.length === 0) {
    return <p className="studio-output__placeholder">No reviews yet. Be the first to respond.</p>;
  }

  return (
    <div className="review-list">
      {reviews.map((review) => (
        <article key={review.id} className="review-card">
          <header>
            <strong>{review.reviewerName}</strong>
            <span>{new Date(review.createdAt).toLocaleString()}</span>
          </header>
          <RatingStars value={review.rating} size={16} readOnly />
          <p>{review.comment}</p>
          {canModerate && (
            <div>
              <button type="button" className="ghost-button" onClick={() => onDelete?.(review.id)}>
                Delete
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
