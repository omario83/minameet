import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { requireRole } from "@/lib/auth";
import { getVendor } from "@/lib/vendor";

export default function VendorPortalLayout({ children }: LayoutProps<"/leverancier">) {
  return (
    <Suspense fallback={<p className="p-6 text-ink/60">Laden…</p>}>
      <VendorShell>{children}</VendorShell>
    </Suspense>
  );
}

async function VendorShell({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("vendor");
  const { supabase, vendor } = await getVendor();

  // Een nieuwe partner doorloopt bij de eerste keer eerst de instelassistent (alles daarin is overslaanbaar).
  if (vendor.status === "draft" && !vendor.setup_completed_at) redirect("/leverancier/start");

  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);

  return (
    <PortalShell companyName={vendor.company_name} personName={profile.full_name ?? ""} unread={count ?? 0}>
      {children}
    </PortalShell>
  );
}
