import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { getResendStatus } from "@/lib/pending-email";

export default function VendorCheckMailPage() {
  return (
    <AuthShell
      tone="vendor"
      title="Controleer je e-mail"
      subtitle="Klik op de link in de e-mail om je account te activeren en je aanmelding af te ronden."
      footer={
        <Link href="/leverancier/inloggen" className="font-semibold text-brand">
          Naar inloggen
        </Link>
      }
    >
      <Suspense fallback={null}>
        <CheckMailContent />
      </Suspense>
    </AuthShell>
  );
}

async function CheckMailContent() {
  const { email, secondsLeft } = await getResendStatus();

  return (
    <>
      {email ? (
        <p className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm">
          We hebben een e-mail gestuurd naar <strong className="break-all">{email}</strong>.
        </p>
      ) : (
        <p className="mb-4 text-sm text-ink/70">Vul je e-mailadres in om een nieuwe bevestigingsmail te ontvangen.</p>
      )}

      <ul className="mb-6 list-disc space-y-1 pl-5 text-sm text-ink/70">
        <li>Kijk ook in je spam- of ongewenste mail.</li>
        <li>Open de link in dezelfde browser als waarmee je je aanmeldde.</li>
        {email && (
          <li>
            Staat er een typfout in je e-mailadres?{" "}
            <Link href="/leverancier/registreren" className="font-semibold text-brand underline">
              Ga terug om het te wijzigen
            </Link>
            .
          </li>
        )}
      </ul>

      <ResendConfirmation initialSecondsLeft={secondsLeft} askEmail={!email} />
    </>
  );
}
