import { useMemo } from "react";
import { Star } from "lucide-react";
import { clsx } from "clsx";

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
}

export function RatingStars({ value, onChange, size = 18, readOnly = false }: RatingStarsProps) {
  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  return (
    <div className="rating-stars">
      {stars.map((star) => {
        const active = value >= star;
        return (
          <button
            key={star}
            type="button"
            className={clsx("rating-star", active && "rating-star--active", readOnly && "rating-star--readonly")}
            onClick={() => !readOnly && onChange?.(star)}
            aria-label={readOnly ? undefined : `Select ${star} star${star > 1 ? "s" : ""}`}
            disabled={readOnly}
          >
            <Star size={size} />
          </button>
        );
      })}
    </div>
  );
}
