import type { CSSProperties } from "react";
import { useLearnedSet } from "@/lib/progress";

interface Props {
  total: number;
}

export default function ReadingProgress({ total }: Props) {
  const learned = useLearnedSet();
  const read = [...learned].filter((slug) => slug.length > 0).length;
  const percent = total === 0 ? 0 : Math.round((read / total) * 100);

  if (read === 0) {
    return (
      <p className="progress-empty">
        Your map starts blank.{" "}
        <a className="text-link" href="/concepts">
          Pick a first entry
        </a>
        .
      </p>
    );
  }

  return (
    <div className="reading-progress">
      <div className="progress-inline">
        <span>
          {read} of {total} entries read
        </span>
        <span
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={read}
          aria-label={`${read} of ${total} entries read`}
        >
          <span
            className="progress-fill"
            style={{ "--progress": `${percent}%` } as CSSProperties}
          />
        </span>
      </div>
      <a className="text-link" href="/concepts">
        Continue the index <span className="arrow">→</span>
      </a>
    </div>
  );
}
