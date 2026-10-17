import {
  Building2,
  Camera,
  Disc3,
  Sparkles,
  UtensilsCrossed,
  Flower2,
  type LucideIcon,
} from "lucide-react";

export type Category = {
  slug: string;
  /** Waarde van de enum `listing_category` in de database. */
  db: "venue" | "catering" | "dj" | "photographer" | "decor" | "other";
  label: string;
  blurb: string;
  gradient: string;
  icon: LucideIcon;
};

// Gradient-klassen staan voluit in de bron zodat Tailwind ze herkent.
export const CATEGORIES: Category[] = [
  {
    slug: "zalen",
    db: "venue",
    label: "Feestzalen",
    blurb: "Van intiem tot 800 gasten",
    gradient: "from-forest to-[#3f7d5c]",
    icon: Building2,
  },
  {
    slug: "catering",
    db: "catering",
    label: "Catering",
    blurb: "Halal, buffet of diner",
    gradient: "from-[#a8330a] to-[#f26b1d]",
    icon: UtensilsCrossed,
  },
  {
    slug: "dj-muziek",
    db: "dj",
    label: "DJ's & muziek",
    blurb: "Van saz tot dansvloer",
    gradient: "from-[#7a2e12] to-[#d9560b]",
    icon: Disc3,
  },
  {
    slug: "fotografie",
    db: "photographer",
    label: "Fotografie",
    blurb: "Foto en video",
    gradient: "from-[#6b4a12] to-[#c98a0a]",
    icon: Camera,
  },
  {
    slug: "decoratie",
    db: "decor",
    label: "Decoratie",
    blurb: "Bloemen, styling, licht",
    gradient: "from-[#8e5a0b] to-[#e0a010]",
    icon: Flower2,
  },
  {
    slug: "overig",
    db: "other",
    label: "Overig",
    blurb: "Taart, vervoer en meer",
    gradient: "from-ink to-[#5a4638]",
    icon: Sparkles,
  },
];
