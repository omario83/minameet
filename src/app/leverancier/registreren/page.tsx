import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { VendorSignUpForm } from "@/components/auth/vendor-signup-form";

export default function VendorRegisterPage() {
  return (
    <AuthShell
      tone="vendor"
      title="Aanmelden als leverancier"
      subtitle="Ontvang offerteaanvragen en beheer je beschikbaarheid."
      footer={
        <>
          Al een account?{" "}
          <Link href="/leverancier/inloggen" className="font-semibold text-brand">
            Inloggen
          </Link>
        </>
      }
    >
      <VendorSignUpForm />
    </AuthShell>
  );
}
