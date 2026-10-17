import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { signUpCustomer } from "@/lib/auth-actions";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Account maken"
      subtitle="Vergelijk aanbieders en vraag offertes aan voor je feest."
      footer={
        <>
          Al een account?{" "}
          <Link href="/inloggen" className="font-semibold text-brand">
            Inloggen
          </Link>
          <br />
          Leverancier?{" "}
          <Link href="/leverancier/registreren" className="font-semibold text-brand">
            Meld je hier aan
          </Link>
        </>
      }
    >
      <AuthForm
        action={signUpCustomer}
        submitLabel="Account maken"
        accent="bg-coral"
        fields={[
          { name: "full_name", label: "Naam", autoComplete: "name" },
          { name: "email", label: "E-mailadres", type: "email", autoComplete: "email" },
          { name: "password", label: "Wachtwoord (min. 8 tekens)", type: "password", autoComplete: "new-password" },
        ]}
      />
    </AuthShell>
  );
}
