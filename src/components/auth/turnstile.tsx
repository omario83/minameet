"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: { sitekey: string; language: string }) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | undefined;
let warned = false;

function warnMissingKey() {
  if (warned) return;
  warned = true;
  console.warn("[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY ontbreekt: captcha wordt overgeslagen. Dit kan alleen in development; productie-builds weigeren te starten zonder sleutel.");
}

function loadScript() {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile kon niet laden"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Plaatst een verborgen veld `cf-turnstile-response` in het omliggende formulier.
 * Een token is eenmalig te gebruiken: `resetSignal` wijzigt na elke verzending en vraagt een nieuw token aan.
 * Zonder NEXT_PUBLIC_TURNSTILE_SITE_KEY wordt niets getoond (next.config.ts staat dat alleen buiten productie toe).
 */
export function Turnstile({ resetSignal }: { resetSignal: unknown }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const el = container.current;
    if (!SITE_KEY) return warnMissingKey();
    if (!el) return;

    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId.current = window.turnstile.render(el, { sitekey: SITE_KEY, language: "nl" });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [resetSignal]);

  return SITE_KEY ? <div ref={container} /> : null;
}
