import { DetailsForm } from "@/components/vendor/details-form";
import { StatusBanner } from "@/components/vendor/status-banner";
import { getOnboarding } from "@/lib/onboarding";

export default async function BusinessDetailsPage() {
  const { vendor, details, email } = await getOnboarding();

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Bedrijfsgegevens</h1>
      <p className="mb-6 mt-1 text-ink/60">We gebruiken deze gegevens om je aanmelding te controleren. Ze zijn niet zichtbaar voor klanten.</p>
      <StatusBanner vendor={vendor} />
      <div className="mt-6 max-w-3xl">
        <DetailsForm defaults={details ?? { contact_email: email }} onboarding />
      </div>
    </>
  );
}
