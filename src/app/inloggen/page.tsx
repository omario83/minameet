import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { LinkExpiredNotice } from "@/components/auth/link-expired-notice";
import { signInCustomer } from "@/lib/auth-actions";

export default function LoginPage() {
  return (
    <AuthShell
      title="Welkom terug"
      subtitle="Log in om je offertes en aanvragen te bekijken."
      footer={
        <>
          Nog geen account?{" "}
          <Link href="/registreren" className="font-semibold text-brand">
            Account maken
          </Link>
          <br />
          Leverancier?{" "}
          <Link href="/leverancier/inloggen" className="font-semibold text-brand">
            Log hier in
          </Link>
        </>
      }
    >
      <LinkExpiredNotice />
      <AuthForm
        action={signInCustomer}
        submitLabel="Inloggen"
        accent="bg-coral"
        fields={[
          { name: "email", label: "E-mailadres", type: "email", autoComplete: "email" },
          { name: "password", label: "Wachtwoord", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthShell>
  );
}
