import { useLearned } from "@/lib/progress";

interface Props {
  slug: string;
  title: string;
}

export default function LearnButton({ slug, title }: Props) {
  const { learned, toggle } = useLearned(slug);

  return (
    <button
      type="button"
      className="learn-button"
      aria-pressed={learned}
      onClick={toggle}
      title={learned ? `Mark ${title} as unread` : `Mark ${title} as read`}
    >
      <span className="learn-check" aria-hidden="true">
        <svg viewBox="0 0 12 12" fill="none">
          <path
            d="M2.2 6.2 4.8 8.8 9.8 3.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>{learned ? "Read" : "Mark as read"}</span>
    </button>
  );
}
