import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { ReminderButton } from "@/components/vendor/reminder-button";
import { StatusBanner } from "@/components/vendor/status-banner";
import { formatClock, formatDate as formatAgendaDate } from "@/lib/agenda/format";
import { loadAgenda, loadListings } from "@/lib/agenda/queries";
import { addDays, toLocal } from "@/lib/agenda/time";
import { eur, formatDate } from "@/lib/format";
import { checklist } from "@/lib/onboarding-steps";
import { getGoLiveState, getVendor } from "@/lib/vendor";

type Req = { id: string; event_type: string | null; event_date: string | null; contact_name: string | null; guest_count: number | null };

const TASK_LABEL: Record<string, string> = {
  answer_request: "Aanvraag beantwoorden",
  follow_up_quote: "Offerte opvolgen",
};

function daysSince(iso: string | null) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function isPast(iso: string | null) {
  return !!iso && new Date(iso).getTime() < Date.now();
}

export default async function VendorDashboard() {
  const { supabase, vendor } = await getVendor();
  const today = toLocal(new Date()).date;
  const notLive = vendor.status === "draft" || vendor.status === "rejected";

  const [open, drafts, sent, bookings, tasks, notifications, upcoming, goLive] = await Promise.all([
    supabase
      .from("quote_requests")
      .select("id, event_type, event_date, contact_name, guest_count")
      .eq("vendor_id", vendor.id)
      .eq("status", "open")
      .order("created_at"),
    supabase
      .from("quotes")
      .select("id, request_id, total_cents, quote_requests(id, event_type, event_date, contact_name, guest_count)")
      .eq("vendor_id", vendor.id)
      .eq("status", "draft"),
    supabase
      .from("quotes")
      .select("id, request_id, total_cents, valid_until, sent_at, quote_requests(id, event_type, event_date, contact_name, guest_count), reminders(created_at)")
      .eq("vendor_id", vendor.id)
      .eq("status", "sent")
      .order("sent_at"),
    supabase.from("bookings").select("id, date, total_cents, commission_cents").eq("vendor_id", vendor.id).order("date", { ascending: false }).limit(10),
    supabase
      .from("tasks")
      .select("id, kind, due_at, request_id")
      .eq("vendor_id", vendor.id)
      .is("done_at", null)
      .order("due_at")
      .limit(10),
    supabase.from("notifications").select("id, title, body, link").is("read_at", null).order("created_at", { ascending: false }).limit(5),
    loadListings(supabase, vendor.id).then((listings) => loadAgenda(supabase, vendor.id, listings, today, addDays(today, 7))),
    notLive ? getGoLiveState(supabase, vendor.id) : Promise.resolve(null),
  ]);

  const agendaItems = [...upcoming].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 6);
  const tiles = [
    { label: "Open vragen", count: open.data?.length ?? 0, color: "bg-st-open" },
    { label: "Concept-offertes", count: drafts.data?.length ?? 0, color: "bg-st-todo" },
    { label: "Verstuurd, wacht op klant", count: sent.data?.length ?? 0, color: "bg-st-sent" },
    { label: "Geaccepteerd", count: bookings.data?.length ?? 0, color: "bg-st-won" },
  ];

  const reqOf = (v: unknown) => v as Req | null;

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Dashboard</h1>

      <StatusBanner vendor={vendor} />

      {goLive && (
        <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm" aria-labelledby="golive-title">
          <h2 id="golive-title" className="font-display text-lg font-bold">
            Ga live voor klanten
          </h2>
          <p className="mt-1 text-sm text-ink/60">Je kunt het portaal al gebruiken. Om zichtbaar te worden voor klanten stuur je je aanmelding in ter beoordeling.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {checklist(goLive).map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                {item.done ? <Check aria-hidden className="size-5 text-st-won" /> : <Circle aria-hidden className="size-5 text-ink/30" />}
                <span className={item.done ? "text-ink/60" : "font-medium"}>{item.label}</span>
              </li>
            ))}
          </ul>
          <Link href="/leverancier/aanmelden" className="mt-5 inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white hover:brightness-110">
            Aanmelding afronden
          </Link>
        </section>
      )}

      {notifications.data && notifications.data.length > 0 && (
        <ul id="meldingen" className="mt-4 space-y-2">
          {notifications.data.map((n) => (
            <li key={n.id} className="rounded-2xl bg-white px-5 py-3 text-sm shadow-sm">
              {n.link ? <Link href={n.link} className="font-semibold text-brand">{n.title}</Link> : <span className="font-semibold">{n.title}</span>}
              {n.body && <span className="text-ink/60"> · {n.body}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(({ label, count, color }) => (
          <div key={label} className="rounded-3xl bg-white p-5 shadow-sm">
            <span className={`inline-block size-3 rounded-full ${color}`} />
            <p className="mt-3 font-display text-4xl font-extrabold">{count}</p>
            <p className="text-sm text-ink/60">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <span className="size-3 rounded-full bg-st-open" /> Agenda, komende 7 dagen
            </h2>
            <Link href="/leverancier/agenda" className="text-sm font-semibold text-brand underline">
              Open agenda
            </Link>
          </div>
          {agendaItems.length === 0 ? (
            <p className="text-sm text-ink/50">Niets gepland. Klik in je agenda op een tijdvak om een afspraak toe te voegen.</p>
          ) : (
            <ul className="divide-y divide-ink/5">
              {agendaItems.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="font-medium">{e.title}</span>
                  <span className="text-ink/60">
                    {formatAgendaDate(toLocal(e.startsAt).date, { weekday: "short", day: "numeric", month: "short" })} · {e.allDay ? "hele dag" : formatClock(e.startsAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Section title="Taken" color="bg-st-todo" empty="Geen openstaande taken.">
          {tasks.data?.map((t) => {
            const overdue = isPast(t.due_at);
            return (
              <Row key={t.id} href={`/leverancier/aanvragen/${t.request_id}`} title={TASK_LABEL[t.kind] ?? t.kind} meta={t.due_at ? `${overdue ? "Te laat · " : "Uiterlijk "}${formatDate(t.due_at)}` : ""} danger={!!overdue} />
            );
          })}
        </Section>

        <Section title="Open vragen" color="bg-st-open" empty="Geen open vragen.">
          {open.data?.map((r) => (
            <Row key={r.id} href={`/leverancier/aanvragen/${r.id}`} title={`${r.event_type ?? "Feest"} · ${r.contact_name ?? ""}`} meta={`${formatDate(r.event_date)}${r.guest_count ? ` · ${r.guest_count} gasten` : ""}`} />
          ))}
        </Section>

        <Section title="Concept-offertes" color="bg-st-todo" empty="Geen concepten.">
          {drafts.data?.map((q) => {
            const r = reqOf(q.quote_requests);
            return <Row key={q.id} href={`/leverancier/aanvragen/${q.request_id}`} title={`${r?.event_type ?? "Feest"} · ${r?.contact_name ?? ""}`} meta={eur(q.total_cents)} />;
          })}
        </Section>

        <Section title="Verstuurd, nog niet geaccepteerd" color="bg-st-sent" empty="Geen openstaande offertes.">
          {sent.data?.map((q) => {
            const r = reqOf(q.quote_requests);
            const days = daysSince(q.sent_at);
            const lastReminder = ((q.reminders ?? []) as { created_at: string }[]).map((x) => x.created_at).sort().at(-1);
            return (
              <li key={q.id} className="space-y-2 py-3">
                <Link href={`/leverancier/aanvragen/${q.request_id}`} className="flex justify-between gap-3 font-medium hover:text-brand">
                  <span>{r?.event_type ?? "Feest"} · {r?.contact_name}</span>
                  <span>{eur(q.total_cents)}</span>
                </Link>
                <p className="text-xs text-ink/50">
                  {days === 0 ? "Vandaag verstuurd" : `${days} dagen geleden verstuurd`}
                  {lastReminder && ` · herinnerd op ${formatDate(lastReminder)}`}
                </p>
                <ReminderButton quoteId={q.id} />
              </li>
            );
          })}
        </Section>

        <Section title="Boekingen" color="bg-st-won" empty="Nog geen boekingen.">
          {bookings.data?.map((b) => (
            <Row key={b.id} href="#" title={formatDate(b.date)} meta={`${eur(b.total_cents)} · commissie ${eur(b.commission_cents)}`} />
          ))}
        </Section>
      </div>
    </>
  );
}

function Section({ title, color, empty, children }: { title: string; color: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = !items || (Array.isArray(items) && items.length === 0);
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
        <span className={`size-3 rounded-full ${color}`} /> {title}
      </h2>
      {isEmpty ? <p className="text-sm text-ink/50">{empty}</p> : <ul className="divide-y divide-ink/5">{children}</ul>}
    </section>
  );
}

function Row({ href, title, meta, danger }: { href: string; title: string; meta: string; danger?: boolean }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 py-3 hover:text-brand">
        <span className="font-medium">{title}</span>
        <span className={`text-sm ${danger ? "font-semibold text-st-lost" : "text-ink/50"}`}>{meta}</span>
      </Link>
    </li>
  );
}
