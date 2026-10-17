"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarDays, ChevronLeft, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Package, RefreshCw, Settings, X } from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { signOut } from "@/lib/auth-actions";

const NAV = [
  { href: "/leverancier/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leverancier/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/leverancier/aanbod", label: "Aanbod", icon: Package },
  { href: "/leverancier/profiel", label: "Instellingen", icon: Settings },
];

const TITLES: Record<string, string> = {
  "/leverancier/dashboard": "Dashboard",
  "/leverancier/agenda": "Agenda",
  "/leverancier/aanbod": "Aanbod",
  "/leverancier/profiel": "Instellingen",
  "/leverancier/aanvragen": "Aanvraag",
};

export function PortalShell({
  companyName,
  personName,
  unread,
  children,
}: {
  companyName: string;
  personName: string;
  unread: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const section = Object.keys(TITLES).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  const onDashboard = pathname === "/leverancier/dashboard";

  const sidebar = (compact: boolean) => (
    <div className="flex h-full flex-col bg-ink text-white">
      <div className={`flex h-16 items-center ${compact ? "justify-center" : "px-5"}`}>
        <Link href="/leverancier/dashboard" aria-label="MinaMeet partner">
          {compact ? <LogoMark className="h-7" /> : <Logo onDark />}
        </Link>
      </div>
      {!compact && <p className="px-5 pb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Partnerportaal</p>}
      <nav aria-label="Hoofdmenu" className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              title={compact ? label : undefined}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${compact ? "justify-center" : ""} ${active ? "bg-brand text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              {!compact && label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 px-3 pb-4">
        <form action={signOut}>
          <button title={compact ? "Uitloggen" : undefined} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white ${compact ? "justify-center" : ""}`}>
            <LogOut aria-hidden className="size-5 shrink-0" />
            {!compact && "Uitloggen"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Menu uitklappen" : "Menu inklappen"}
          className={`hidden h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white lg:flex ${compact ? "justify-center" : ""}`}
        >
          {collapsed ? <PanelLeftOpen aria-hidden className="size-5" /> : <PanelLeftClose aria-hidden className="size-5" />}
          {!compact && "Inklappen"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1 bg-cream">
      <aside className={`sticky top-0 hidden h-screen shrink-0 lg:block ${collapsed ? "w-[72px]" : "w-64"}`}>{sidebar(collapsed)}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Menu sluiten" className="absolute inset-0 bg-ink/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar(false)}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink/10 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Menu openen" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sand lg:hidden">
            {mobileOpen ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
          {!onDashboard && (
            <Link href="/leverancier/dashboard" aria-label="Terug naar dashboard" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sand">
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold leading-tight">{companyName}</p>
            <p className="truncate text-xs text-ink/50">
              {section ? TITLES[section] : "Partnerportaal"} · {personName}
            </p>
          </div>
          <button type="button" onClick={() => router.refresh()} aria-label="Pagina verversen" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sand">
            <RefreshCw aria-hidden className="size-5" />
          </button>
          <Link href="/leverancier/dashboard#meldingen" aria-label={unread ? `${unread} ongelezen meldingen` : "Meldingen"} className="relative inline-flex size-10 items-center justify-center rounded-full hover:bg-sand">
            <Bell aria-hidden className="size-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-st-lost px-1 text-[11px] font-bold leading-5 text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
