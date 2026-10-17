import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { LinkExpiredNotice } from "@/components/auth/link-expired-notice";
import { signInVendor } from "@/lib/auth-actions";

export default function VendorLoginPage() {
  return (
    <AuthShell
      tone="vendor"
      title="Leveranciersportaal"
      subtitle="Log in om je aanvragen, offertes en kalender te beheren."
      footer={
        <>
          <Link href="/leverancier/wachtwoord-vergeten" className="font-semibold text-brand">
            Wachtwoord vergeten?
          </Link>
          <br />
          <Link href="/leverancier/registreren/controleer-mail" className="font-semibold text-brand">
            Geen bevestigingsmail ontvangen?
          </Link>
          <br />
          Nog geen leveranciersaccount?{" "}
          <Link href="/leverancier/registreren" className="font-semibold text-brand">
            Aanmelden
          </Link>
          <br />
          Klant?{" "}
          <Link href="/inloggen" className="font-semibold text-brand">
            Log hier in
          </Link>
        </>
      }
    >
      <LinkExpiredNotice vendor />
      <AuthForm
        action={signInVendor}
        submitLabel="Inloggen"
        accent="bg-brand"
        fields={[
          { name: "email", label: "E-mailadres", type: "email", autoComplete: "email" },
          { name: "password", label: "Wachtwoord", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthShell>
  );
}
