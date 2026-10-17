// Foto's en video staan in public/media (bron: Pixabay, zie CREDITS.tsv). Een lege lijst toont een kleurverloop.
const list = (group: string, count: number) => Array.from({ length: count }, (_, i) => `/media/${group}-${i + 1}.jpg`);

export const MEDIA = {
  heroVideo: "/media/hero.mp4" as string | null,
  heroPoster: "/media/hero-poster.jpg" as string | null,
  plan: list("plan", 5),
  services: list("services", 6),
  locations: list("locations", 5),
  steps: list("steps", 4),
  // Zelfde volgorde als EVENT_TYPES op de homepage.
  events: list("events", 6),
};
