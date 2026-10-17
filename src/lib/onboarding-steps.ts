import { MIN_PHOTOS } from "@/lib/photos";

export type StepKey = "bedrijfsgegevens" | "aanbod" | "insturen";

export type OnboardingState = {
  hasDetails: boolean;
  listings: { id: string; photoCount: number }[];
};

export const STEP_PATH: Record<StepKey, string> = {
  bedrijfsgegevens: "/leverancier/aanmelden/bedrijfsgegevens",
  aanbod: "/leverancier/aanmelden/aanbod",
  insturen: "/leverancier/aanmelden/insturen",
};

export function checklist(state: OnboardingState) {
  const hasListing = state.listings.length > 0;
  return [
    { key: "details", label: "Bedrijfsgegevens ingevuld", done: state.hasDetails },
    { key: "listing", label: "Eerste aanbod toegevoegd", done: hasListing },
    {
      key: "photos",
      label: `Minimaal ${MIN_PHOTOS} foto's bij elk aanbod`,
      done: hasListing && state.listings.every((l) => l.photoCount >= MIN_PHOTOS),
    },
  ];
}

export function isComplete(state: OnboardingState) {
  return checklist(state).every((item) => item.done);
}

/** De eerstvolgende stap waarvoor nog iets ontbreekt. */
export function nextStep(state: OnboardingState): StepKey {
  if (!state.hasDetails) return "bedrijfsgegevens";
  return isComplete(state) ? "insturen" : "aanbod";
}

/** De wizardstap waar een partner nu hoort te zijn; null als de aanmelding niet (meer) loopt. */
export function onboardingStepFor(status: string, state: OnboardingState): StepKey | null {
  return status === "draft" || status === "rejected" ? nextStep(state) : null;
}
