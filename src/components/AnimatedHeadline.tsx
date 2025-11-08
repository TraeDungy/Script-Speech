"use client";

import { useEffect, useMemo, useState } from "react";

const ROTATION_INTERVAL = 3600;

interface AnimatedHeadlineProps {
  phrases: string[];
}

export function AnimatedHeadline({ phrases }: AnimatedHeadlineProps) {
  const safePhrases = useMemo(() => (phrases.length ? phrases : [""]), [phrases]);
  const [index, setIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setPrefersReducedMotion(false);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(event.matches);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange);

      return () => {
        mediaQuery.removeListener(handleChange);
      };
    }

    return () => {};
  }, []);

  useEffect(() => {
    if (prefersReducedMotion !== false || safePhrases.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % safePhrases.length);
    }, ROTATION_INTERVAL);

    return () => {
      window.clearInterval(timer);
    };
  }, [prefersReducedMotion, safePhrases.length]);

  const shouldReduceMotion = prefersReducedMotion === true;
  const visiblePhraseIndex = shouldReduceMotion ? 0 : index;
  const visiblePhrase = safePhrases[visiblePhraseIndex];

  return (
    <span
      className="relative inline-flex h-[1.4em] overflow-hidden align-middle text-gradient-sheen"
      data-motion={shouldReduceMotion ? "reduced" : "enabled"}
      data-testid="animated-headline"
    >
      {shouldReduceMotion ? (
        <span
          className="text-balance text-left text-3xl font-medium tracking-tight md:text-5xl"
          data-testid="static-phrase"
        >
          {visiblePhrase}
        </span>
      ) : (
        safePhrases.map((phrase, phraseIndex) => (
          <span
            key={phrase}
            className={`absolute inset-x-0 text-balance text-left text-3xl font-medium tracking-tight transition-all duration-700 ease-out md:text-5xl ${
              phraseIndex === index ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
            }`}
            data-testid="animated-phrase"
          >
            {phrase}
          </span>
        ))
      )}
      <span className="invisible text-3xl md:text-5xl">{visiblePhrase}</span>
    </span>
  );
}
