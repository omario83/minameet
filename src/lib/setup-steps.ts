export const SETUP_STEPS = [
  { key: "welkom", path: "/leverancier/start", label: "Welkom" },
  { key: "diensten", path: "/leverancier/start/diensten", label: "Diensten" },
  { key: "kalender", path: "/leverancier/start/kalender", label: "Agenda" },
  { key: "bedrijf", path: "/leverancier/start/bedrijf", label: "Bedrijf" },
  { key: "fotos", path: "/leverancier/start/fotos", label: "Foto's" },
  { key: "klaar", path: "/leverancier/start/klaar", label: "Klaar" },
] as const;

export type SetupStepKey = (typeof SETUP_STEPS)[number]["key"];

export function setupStepIndex(pathname: string) {
  return Math.max(
    0,
    SETUP_STEPS.findIndex((step) => step.path === pathname),
  );
}
