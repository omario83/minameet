"use client";

import { useEffect, useState } from "react";

export function RotatingWords({ words, interval = 2800 }: { words: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => clearInterval(timer);
  }, [words.length, interval]);

  // Alle woorden op dezelfde plek, zodat de zin niet verspringt.
  return (
    <span className="inline-grid align-bottom">
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden={i !== index}
          className={`col-start-1 row-start-1 transition-all duration-700 motion-reduce:transition-none ${
            i === index ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
