import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { updateVendorPassword } from "@/lib/auth-actions";

// Bereikbaar via de link in de herstelmail; de proxy eist een sessie.
export default function VendorResetPasswordPage() {
  return (
    <AuthShell tone="vendor" title="Nieuw wachtwoord" subtitle="Kies een nieuw wachtwoord voor je partneraccount." footer={null}>
      <AuthForm
        action={updateVendorPassword}
        submitLabel="Wachtwoord opslaan"
        accent="bg-brand"
        captcha={false}
        fields={[{ name: "password", label: "Nieuw wachtwoord (min. 10 tekens)", type: "password", autoComplete: "new-password" }]}
      />
    </AuthShell>
  );
}
