import { describe, expect, it } from "vitest";
import { checklist, isComplete, nextStep, onboardingStepFor } from "@/lib/onboarding-steps";

const photos = (n: number) => ({ id: "x", photoCount: n });

describe("onboarding", () => {
  it("begint bij de bedrijfsgegevens", () => {
    expect(nextStep({ hasDetails: false, listings: [] })).toBe("bedrijfsgegevens");
    expect(nextStep({ hasDetails: false, listings: [photos(8)] })).toBe("bedrijfsgegevens");
  });

  it("vraagt om aanbod en foto's na de bedrijfsgegevens", () => {
    expect(nextStep({ hasDetails: true, listings: [] })).toBe("aanbod");
    expect(nextStep({ hasDetails: true, listings: [photos(4)] })).toBe("aanbod");
  });

  it("eist 5 foto's bij elk aanbod", () => {
    expect(isComplete({ hasDetails: true, listings: [photos(5), photos(4)] })).toBe(false);
    expect(isComplete({ hasDetails: true, listings: [photos(5), photos(8)] })).toBe(true);
    expect(nextStep({ hasDetails: true, listings: [photos(5)] })).toBe("insturen");
  });

  it("toont per onderdeel of het klaar is", () => {
    expect(checklist({ hasDetails: true, listings: [] }).map((i) => i.done)).toEqual([true, false, false]);
  });

  it("bepaalt de stap alleen voor een lopende aanmelding (draft of rejected)", () => {
    const empty = { hasDetails: false, listings: [] };
    const complete = { hasDetails: true, listings: [photos(5)] };

    expect(onboardingStepFor("draft", empty)).toBe("bedrijfsgegevens");
    expect(onboardingStepFor("rejected", { hasDetails: true, listings: [] })).toBe("aanbod");
    expect(onboardingStepFor("rejected", complete)).toBe("insturen");
    for (const status of ["pending", "approved", "suspended"]) expect(onboardingStepFor(status, complete)).toBeNull();
  });
});
