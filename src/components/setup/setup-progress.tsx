"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { SETUP_STEPS, setupStepIndex } from "@/lib/setup-steps";

export function SetupProgress() {
  const current = setupStepIndex(usePathname());

  return (
    <nav aria-label="Voortgang">
      <ol className="flex items-center justify-between gap-1">
        {SETUP_STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step.key} aria-current={active ? "step" : undefined} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${
                  done ? "bg-st-won text-white" : active ? "bg-brand text-white" : "bg-white text-ink/40 ring-1 ring-ink/10"
                }`}
              >
                {done ? <Check aria-hidden className="size-4" /> : index + 1}
              </span>
              <span className={`text-xs font-medium ${active ? "text-ink" : "text-ink/50"}`}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
