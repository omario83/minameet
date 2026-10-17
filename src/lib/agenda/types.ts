// Gedeelde types voor de agenda (ook in de browser gebruikt).

export type AgendaEvent = {
  id: string;
  /** item: zelf aangemaakt of uit een gekoppelde kalender; booking: boeking via MinaMeet; availability: dag met optie of geboekt op een aanbod. */
  source: "item" | "booking" | "availability";
  kind: "appointment" | "block" | "external" | "booking" | "availability";
  status: "pending" | "confirmed" | "completed" | "blocked" | "external";
  title: string;
  subtitle: string | null;
  /** ISO-tijdstippen (UTC). */
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  priceCents: number | null;
  listingId: string | null;
  customerName: string | null;
  note: string | null;
  /** Alleen eigen afspraken en blokkades zijn te wijzigen. */
  editable: boolean;
};

export type AgendaListing = { id: string; title: string };

export type FeedInfo = {
  host: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};
