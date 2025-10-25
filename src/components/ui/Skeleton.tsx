import { Fragment } from "react";

export function Skeleton({ lines = 6, lineWidth = "100%" }: { lines?: number; lineWidth?: string }) {
  const items = Array.from({ length: lines });
  return (
    <div className="skeleton-lines">
      {items.map((_, i) => (
        <Fragment key={i}>
          <div className="skeleton skeleton-line" style={{ width: i === lines - 1 ? lineWidth : "100%" }} />
        </Fragment>
      ))}
    </div>
  );
}

