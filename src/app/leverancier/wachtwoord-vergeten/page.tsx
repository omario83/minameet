import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { QueryNotice } from "@/components/auth/query-notice";
import { requestVendorPasswordReset } from "@/lib/auth-actions";

export default function VendorForgotPasswordPage() {
  return (
    <AuthShell
      tone="vendor"
      title="Wachtwoord vergeten"
      subtitle="Vul je e-mailadres in. Je ontvangt een link om een nieuw wachtwoord te kiezen."
      footer={
        <Link href="/leverancier/inloggen" className="font-semibold text-brand">
          Terug naar inloggen
        </Link>
      }
    >
      <QueryNotice
        param="melding"
        messages={{ "link-verlopen": "Die link is verlopen, al gebruikt of in een andere browser geopend. Vraag hieronder een nieuwe aan en open die in dezelfde browser." }}
      />
      <AuthForm
        action={requestVendorPasswordReset}
        submitLabel="Stuur link"
        accent="bg-brand"
        fields={[{ name: "email", label: "E-mailadres", type: "email", autoComplete: "email" }]}
      />
    </AuthShell>
  );
}
