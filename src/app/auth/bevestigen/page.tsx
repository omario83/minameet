import { AuthShell } from "@/components/auth/auth-shell";
import { confirmEmailLink } from "@/lib/auth-actions";

export const metadata = { robots: { index: false } };

// Landingspunt van de link in een mail. De code wordt pas verbruikt na een klik, niet bij het openen van de pagina.
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash = "", type = "", next = "" } = await searchParams;
  const isReset = type === "recovery";

  return (
    <AuthShell
      tone="vendor"
      title={isReset ? "Nieuw wachtwoord kiezen" : "Bevestig je e-mailadres"}
      subtitle={isReset ? "Klik op de knop om verder te gaan en een nieuw wachtwoord in te stellen." : "Klik op de knop om je account te bevestigen."}
      footer={null}
    >
      <form action={confirmEmailLink}>
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="h-12 w-full rounded-full bg-brand font-semibold text-white transition hover:brightness-110">
          Doorgaan
        </button>
      </form>
    </AuthShell>
  );
}
