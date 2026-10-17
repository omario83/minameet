"use client";

import { useEffect, useRef } from "react";

/** Laadt de video alleen op een computer met beweging aan en zonder databesparing. */
export function HeroVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const allowed =
      window.matchMedia("(min-width: 768px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !connection?.saveData;
    if (!allowed) return;

    video.src = src;
    video.play().catch(() => undefined);
  }, [src]);

  return <video ref={ref} aria-hidden muted loop playsInline preload="none" poster={poster} className="absolute inset-0 size-full object-cover" />;
}
