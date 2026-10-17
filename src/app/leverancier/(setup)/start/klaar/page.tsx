import { Check, Circle } from "lucide-react";
import { loadFeed } from "@/lib/agenda/queries";
import { MIN_PHOTOS } from "@/lib/photos";
import { completeSetup } from "@/lib/setup-actions";
import { getGoLiveState, getVendor } from "@/lib/vendor";

export default async function SetupDonePage() {
  const { supabase, vendor } = await getVendor();
  const [state, feed, { count: hours }] = await Promise.all([
    getGoLiveState(supabase, vendor.id),
    loadFeed(supabase, vendor.id),
    supabase.from("vendor_opening_hours").select("vendor_id", { count: "exact", head: true }).eq("vendor_id", vendor.id),
  ]);

  const items = [
    { label: "Diensten en prijzen", done: state.listings.length > 0 },
    { label: "Openingstijden", done: (hours ?? 0) > 0 },
    { label: "Eigen kalender gekoppeld", done: !!feed },
    { label: "Bedrijfsgegevens", done: state.hasDetails },
    { label: `Foto's (minimaal ${MIN_PHOTOS} per aanbod)`, done: state.listings.length > 0 && state.listings.every((l) => l.photoCount >= MIN_PHOTOS) },
  ];

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Je account staat klaar</h1>
      <p className="mt-2 text-ink/70">Wat nog niet is ingevuld, vul je later aan in het portaal. Om zichtbaar te worden voor klanten stuur je vanaf het dashboard je aanmelding in.</p>
      <ul className="mt-6 space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            {item.done ? <Check aria-hidden className="size-5 text-st-won" /> : <Circle aria-hidden className="size-5 text-ink/30" />}
            <span className={item.done ? "" : "text-ink/60"}>
              {item.label}
              {!item.done && " (nog niet ingevuld)"}
            </span>
          </li>
        ))}
      </ul>
      <form action={completeSetup} className="mt-8">
        <button className="h-12 rounded-full bg-brand px-8 font-semibold text-white hover:brightness-110">Naar mijn dashboard</button>
      </form>
    </>
  );
}
