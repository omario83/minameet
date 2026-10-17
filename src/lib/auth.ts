import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "customer" | "vendor" | "admin";

export const ROLE_HOME: Record<Role, string> = {
  customer: "/account",
  vendor: "/leverancier/dashboard",
  admin: "/admin",
};

const ROLE_AREA: Record<Role, string> = {
  customer: "/account",
  vendor: "/leverancier",
  admin: "/admin",
};

/** Geeft het pad terug als het een veilig, eigen pad is binnen het gebied van deze rol. */
export function safeNext(value: unknown, role: Role): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return null;
  const area = ROLE_AREA[role];
  return value === area || value.startsWith(`${area}/`) || value.startsWith(`${area}?`) ? value : null;
}

const ROLE_LOGIN: Record<Role, string> = {
  customer: "/inloggen",
  vendor: "/leverancier/inloggen",
  admin: "/admin/inloggen",
};

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("id, role, full_name").eq("id", user.id).single();
  return data as { id: string; role: Role; full_name: string | null } | null;
}

/** Laat alleen de gevraagde rol door; andere rollen gaan naar hun eigen omgeving. */
export async function requireRole(role: Role) {
  const profile = await getProfile();
  if (!profile) redirect(ROLE_LOGIN[role]);
  if (profile.role !== role) redirect(ROLE_HOME[profile.role]);
  return profile;
}
