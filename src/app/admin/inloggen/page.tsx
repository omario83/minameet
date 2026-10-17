import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { signInAdmin } from "@/lib/auth-actions";

export default function AdminLoginPage() {
  return (
    <AuthShell tone="vendor" title="Beheer" subtitle="Alleen voor MinaMeet-beheerders." footer={null}>
      <AuthForm
        action={signInAdmin}
        submitLabel="Inloggen"
        accent="bg-ink"
        fields={[
          { name: "email", label: "E-mailadres", type: "email", autoComplete: "email" },
          { name: "password", label: "Wachtwoord", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthShell>
  );
}
