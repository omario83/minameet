import { describe, expect, it } from "vitest";
import { parseIcs } from "@/lib/agenda/ics";
import { zonedToUtc } from "@/lib/agenda/time";

const window = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-12-31T00:00:00Z") };

const VTIMEZONE = `BEGIN:VTIMEZONE
TZID:Europe/Amsterdam
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

const calendar = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//NL", VTIMEZONE, ...events, "END:VCALENDAR"].join("\r\n");

const event = (lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

describe("parseIcs", () => {
  it("leest een afspraak in UTC", () => {
    const [item] = parseIcs(calendar(event(["UID:a1", "DTSTART:20261012T080000Z", "DTEND:20261012T090000Z", "SUMMARY:Overleg"])), window);
    expect(item).toMatchObject({ uid: "a1", title: "Overleg", allDay: false });
    expect(item.startsAt.toISOString()).toBe("2026-10-12T08:00:00.000Z");
    expect(item.endsAt.toISOString()).toBe("2026-10-12T09:00:00.000Z");
  });

  it("leest een afspraak met de tijdzone Europe/Amsterdam", () => {
    const [item] = parseIcs(
      calendar(event(["UID:a2", "DTSTART;TZID=Europe/Amsterdam:20261012T100000", "DTEND;TZID=Europe/Amsterdam:20261012T113000", "SUMMARY:Lokaal"])),
      window,
    );
    expect(item.startsAt.toISOString()).toBe("2026-10-12T08:00:00.000Z");
    expect(item.endsAt.toISOString()).toBe("2026-10-12T09:30:00.000Z");
  });

  it("leest een zwevende tijd als Nederlandse tijd", () => {
    const [item] = parseIcs(calendar(event(["UID:a3", "DTSTART:20261012T100000", "DTEND:20261012T110000", "SUMMARY:Zwevend"])), window);
    expect(item.startsAt.toISOString()).toBe("2026-10-12T08:00:00.000Z");
  });

  it("leest een hele dag, met een einddatum die niet meetelt", () => {
    const [item] = parseIcs(calendar(event(["UID:a4", "DTSTART;VALUE=DATE:20261015", "DTEND;VALUE=DATE:20261017", "SUMMARY:Vakantie"])), window);
    expect(item.allDay).toBe(true);
    expect(item.startsAt.toISOString()).toBe(zonedToUtc("2026-10-15", 0).toISOString());
    expect(item.endsAt.toISOString()).toBe(zonedToUtc("2026-10-17", 0).toISOString());
  });

  it("geeft een hele dag zonder einddatum één dag en een afspraak zonder einde één uur", () => {
    const items = parseIcs(
      calendar(
        event(["UID:b1", "DTSTART;VALUE=DATE:20261020", "SUMMARY:Dag"]),
        event(["UID:b2", "DTSTART:20261021T080000Z", "SUMMARY:Kort"]),
      ),
      window,
    );
    expect(items[0].endsAt.toISOString()).toBe(zonedToUtc("2026-10-21", 0).toISOString());
    expect(items[1].endsAt.toISOString()).toBe("2026-10-21T09:00:00.000Z");
  });

  it("breidt een herhaling uit", () => {
    const items = parseIcs(calendar(event(["UID:c1", "DTSTART:20261012T080000Z", "DTEND:20261012T090000Z", "RRULE:FREQ=WEEKLY;COUNT=3", "SUMMARY:Wekelijks"])), window);
    expect(items.map((i) => i.startsAt.toISOString())).toEqual(["2026-10-12T08:00:00.000Z", "2026-10-19T08:00:00.000Z", "2026-10-26T08:00:00.000Z"]);
    expect(new Set(items.map((i) => i.uid)).size).toBe(3);
  });

  it("houdt een oneindige herhaling binnen de periode", () => {
    const items = parseIcs(calendar(event(["UID:c2", "DTSTART:20261001T080000Z", "DTEND:20261001T090000Z", "RRULE:FREQ=DAILY", "SUMMARY:Elke dag"])), window);
    expect(items.length).toBeGreaterThan(80);
    expect(items.length).toBeLessThanOrEqual(92);
  });

  it("verwerkt een uitzondering op een herhaling", () => {
    const items = parseIcs(
      calendar(
        event(["UID:d1", "DTSTART:20261012T080000Z", "DTEND:20261012T090000Z", "RRULE:FREQ=WEEKLY;COUNT=3", "SUMMARY:Reeks"]),
        event(["UID:d1", "RECURRENCE-ID:20261019T080000Z", "DTSTART:20261019T120000Z", "DTEND:20261019T130000Z", "SUMMARY:Verplaatst"]),
      ),
      window,
    );
    expect(items).toHaveLength(3);
    const moved = items.find((i) => i.title === "Verplaatst");
    expect(moved?.startsAt.toISOString()).toBe("2026-10-19T12:00:00.000Z");
  });

  it("slaat geannuleerde en vrije afspraken over", () => {
    const items = parseIcs(
      calendar(
        event(["UID:e1", "DTSTART:20261012T080000Z", "DTEND:20261012T090000Z", "STATUS:CANCELLED", "SUMMARY:Geannuleerd"]),
        event(["UID:e2", "DTSTART:20261013T080000Z", "DTEND:20261013T090000Z", "TRANSP:TRANSPARENT", "SUMMARY:Vrij"]),
        event(["UID:e3", "DTSTART:20261014T080000Z", "DTEND:20261014T090000Z", "SUMMARY:Bezet"]),
      ),
      window,
    );
    expect(items.map((i) => i.title)).toEqual(["Bezet"]);
  });

  it("laat afspraken buiten de periode weg", () => {
    const items = parseIcs(calendar(event(["UID:f1", "DTSTART:20250101T080000Z", "DTEND:20250101T090000Z", "SUMMARY:Oud"]), event(["UID:f2", "DTSTART:20271001T080000Z", "DTEND:20271001T090000Z", "SUMMARY:Ver weg"])), window);
    expect(items).toEqual([]);
  });

  it("gebruikt 'Bezet' zonder titel en kapt lange titels af", () => {
    const items = parseIcs(
      calendar(
        event(["UID:g1", "DTSTART:20261012T080000Z", "DTEND:20261012T090000Z"]),
        event(["UID:g2", "DTSTART:20261013T080000Z", "DTEND:20261013T090000Z", `SUMMARY:${"x".repeat(300)}`]),
      ),
      window,
    );
    expect(items[0].title).toBe("Bezet");
    expect(items[1].title).toHaveLength(120);
  });

  it("begrenst het aantal afspraken", () => {
    const items = parseIcs(calendar(event(["UID:h1", "DTSTART:20261001T080000Z", "DTEND:20261001T090000Z", "RRULE:FREQ=DAILY", "SUMMARY:Veel"])), window, 10);
    expect(items).toHaveLength(10);
  });

  it("gooit een fout bij een bestand dat geen kalender is", () => {
    expect(() => parseIcs("<html>niet een kalender</html>", window)).toThrow();
  });
});
