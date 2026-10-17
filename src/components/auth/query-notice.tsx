"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Notice({ param, messages }: { param: string; messages: Record<string, string> }) {
  const value = useSearchParams().get(param);
  const text = value ? messages[value] : undefined;
  if (!text) return null;
  return (
    <p role="status" className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm font-medium">
      {text}
    </p>
  );
}

/** Toont een vaste tekst op basis van `?param=waarde`; onbekende waarden worden genegeerd. */
export function QueryNotice(props: { param: string; messages: Record<string, string> }) {
  return (
    <Suspense fallback={null}>
      <Notice {...props} />
    </Suspense>
  );
}
