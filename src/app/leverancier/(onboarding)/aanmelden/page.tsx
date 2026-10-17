import { redirect } from "next/navigation";
import { getOnboarding } from "@/lib/onboarding";
import { STEP_PATH, nextStep } from "@/lib/onboarding-steps";

// Stuurt de partner naar de eerste stap waarvoor nog iets ontbreekt.
export default async function OnboardingIndexPage() {
  const { state } = await getOnboarding();
  redirect(STEP_PATH[nextStep(state)]);
}
