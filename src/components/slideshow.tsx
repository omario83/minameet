"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** Wisselt zacht tussen foto's met een trage zoom; vult het omliggende `relative`-vlak. */
export function Slideshow({
  slides,
  interval = 5500,
  sizes = "100vw",
  priority = false,
}: {
  slides: string[];
  interval?: number;
  sizes?: string;
  priority?: boolean;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(timer);
  }, [slides.length, interval]);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {slides.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes={sizes}
          priority={priority && i === 0}
          className={`object-cover transition-opacity duration-1000 ${i === active ? "kenburns opacity-100" : "opacity-0"}`}
        />
      ))}
    </div>
  );
}
