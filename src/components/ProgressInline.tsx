import type { CSSProperties } from "react";
import { useLearnedSet } from "@/lib/progress";

interface Props {
  slugs: string[];
}

export default function ProgressInline({ slugs }: Props) {
  const learned = useLearnedSet();
  const read = slugs.filter((slug) => learned.has(slug)).length;
  const total = slugs.length;
  const percent = total === 0 ? 0 : Math.round((read / total) * 100);

  return (
    <div className="progress-inline">
      <span>
        {read} / {total} read
      </span>
      <span
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={read}
        aria-label={`${read} of ${total} path entries read`}
      >
        <span
          className="progress-fill"
          style={{ "--progress": `${percent}%` } as CSSProperties}
        />
      </span>
    </div>
  );
}
