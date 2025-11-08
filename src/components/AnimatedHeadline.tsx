"use client";

import { useEffect, useMemo, useState } from "react";

const ROTATION_INTERVAL = 3600;

interface AnimatedHeadlineProps {
  phrases: string[];
}

export function AnimatedHeadline({ phrases }: AnimatedHeadlineProps) {
  const safePhrases = useMemo(() => (phrases.length ? phrases : [""]), [phrases]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (safePhrases.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % safePhrases.length);
    }, ROTATION_INTERVAL);

    return () => {
      window.clearInterval(timer);
    };
  }, [safePhrases.length]);

  return (
    <span className="relative inline-flex h-[1.4em] overflow-hidden align-middle text-gradient-sheen">
      {safePhrases.map((phrase, phraseIndex) => (
        <span
          key={phrase}
          className={`absolute inset-x-0 text-balance text-left text-3xl font-medium tracking-tight transition-all duration-700 ease-out md:text-5xl ${
            phraseIndex === index ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
          }`}
        >
          {phrase}
        </span>
      ))}
      <span className="invisible text-3xl md:text-5xl">{safePhrases[index]}</span>
    </span>
  );
}
