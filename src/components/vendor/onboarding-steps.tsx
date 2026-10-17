"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

const STEPS = [
  { key: "account", label: "Account" },
  { key: "bedrijfsgegevens", label: "Bedrijfsgegevens" },
  { key: "aanbod", label: "Aanbod" },
  { key: "insturen", label: "Insturen" },
] as const;

/** Staat in de layout van de aanmelding; de huidige stap volgt uit het pad. */
export function OnboardingSteps() {
  const pathname = usePathname();
  const found = STEPS.findIndex((step) => pathname.endsWith(`/${step.key}`));
  // Account is al klaar zodra iemand de wizard ziet.
  const currentIndex = Math.max(found, 1);

  return (
    <ol aria-label="Voortgang aanmelding" className="mb-8 flex flex-wrap gap-2 text-sm">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li
            key={step.key}
            aria-current={active ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium ${
              active ? "bg-brand text-white" : done ? "bg-white text-st-won" : "bg-white/60 text-ink/50"
            }`}
          >
            {done ? <Check aria-hidden className="size-4" /> : <span aria-hidden>{i + 1}</span>}
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
