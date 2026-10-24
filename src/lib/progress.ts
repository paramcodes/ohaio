import { useEffect, useState } from "react";

export const PROGRESS_KEY = "ohaio:learned:v1";

export function readLearned(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function setLearned(slug: string, learned: boolean): Set<string> {
  if (typeof window === "undefined") return new Set();
  const next = readLearned();
  if (learned) next.add(slug);
  else next.delete(slug);

  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify([...next]));
  } catch {
    // Progress stays in memory for this session when storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent("ohaio:progress"));
  return next;
}

export function useLearnedSet(): Set<string> {
  const [learned, setLearned] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const sync = () => setLearned(readLearned());
    sync();
    window.addEventListener("ohaio:progress", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ohaio:progress", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return learned;
}

export function useLearned(slug: string) {
  const learned = useLearnedSet();
  return {
    learned: learned.has(slug),
    toggle: () => setLearned(slug, !learned.has(slug)),
  };
}
