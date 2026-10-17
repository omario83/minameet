"use client";

import { useActionState } from "react";
import { Field, FormStatus, inputClass } from "@/components/form-ui";
import { connectCalendarFeed, disconnectCalendarFeed, syncCalendarFeed } from "@/lib/agenda-actions";
import type { FeedInfo } from "@/lib/agenda/types";

function formatSynced(iso: string | null) {
  return iso ? new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "nog niet";
}

export function CalendarFeedForm({ feed }: { feed: FeedInfo | null }) {
  const [connected, connect, connecting] = useActionState(connectCalendarFeed, undefined);
  const [synced, sync, syncing] = useActionState(syncCalendarFeed, undefined);
  const [removed, remove, removing] = useActionState(disconnectCalendarFeed, undefined);
  const urlError = connected?.fieldErrors?.url;

  return (
    <div className="space-y-4">
      {feed && (
        <div className="rounded-2xl bg-brand-soft px-4 py-3 text-sm">
          <p className="font-semibold">Gekoppeld aan {feed.host}</p>
          <p className="text-ink/60">Laatst bijgewerkt: {formatSynced(feed.lastSyncedAt)}</p>
          {feed.lastError && <p className="mt-1 font-medium text-st-lost">{feed.lastError}</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            <form action={sync}>
              <button disabled={syncing} className="h-10 rounded-full border border-ink/15 bg-white px-5 text-sm font-semibold hover:border-brand hover:text-brand disabled:opacity-60">
                {syncing ? "Bezig…" : "Nu bijwerken"}
              </button>
            </form>
            <form action={remove}>
              <button disabled={removing} className="h-10 rounded-full px-5 text-sm font-semibold text-st-lost underline disabled:opacity-60">
                Loskoppelen
              </button>
            </form>
          </div>
          <FormStatus state={synced ?? removed} />
        </div>
      )}

      <form action={connect} className="space-y-3">
        <Field
          id="calendar-url"
          label={feed ? "Ander kalenderadres" : "Kalenderadres (iCal)"}
          hint="Plak het geheime iCal-adres (eindigt meestal op .ics) van je Google-, Apple- of Outlook-agenda. Wij lezen je agenda alleen; wijzigingen doe je in je eigen agenda."
          error={urlError}
        >
          <input
            id="calendar-url"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            aria-invalid={urlError ? true : undefined}
            aria-describedby={urlError ? "calendar-url-error" : "calendar-url-hint"}
            className={inputClass}
          />
        </Field>
        {!urlError && <FormStatus state={connected} />}
        <button disabled={connecting} className="h-11 rounded-full bg-brand px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
          {connecting ? "Koppelen…" : feed ? "Vervangen" : "Kalender koppelen"}
        </button>
      </form>
    </div>
  );
}
