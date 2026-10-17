"use client";

import { useActionState } from "react";
import { Field, FormStatus, inputClass } from "@/components/form-ui";
import { updateVendorProfile } from "@/lib/vendor-actions";
import type { Vendor } from "@/lib/vendor";

export function ProfileForm({ vendor }: { vendor: Vendor }) {
  const [state, action, pending] = useActionState(updateVendorProfile, undefined);

  return (
    <form action={action} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
      <Field id="company_name" label="Bedrijfsnaam">
        <input id="company_name" name="company_name" required defaultValue={vendor.company_name} className={inputClass} />
      </Field>
      <Field id="description" label="Omschrijving">
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={vendor.description ?? ""}
          className={`${inputClass} h-auto py-3`}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="profile_city" label="Plaats">
          <input id="profile_city" name="city" defaultValue={vendor.city ?? ""} className={inputClass} />
        </Field>
        <Field id="region" label="Werkgebied / regio">
          <input id="region" name="region" defaultValue={vendor.region ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field
        id="cultural_tags"
        label="Culturele specialisaties"
        hint="Gescheiden door komma's, bijvoorbeeld: Turks, Marokkaans, Hindoestaans"
      >
        <input id="cultural_tags" name="cultural_tags" defaultValue={vendor.cultural_tags.join(", ")} className={inputClass} />
      </Field>
      <FormStatus state={state} />
      <button disabled={pending} className="h-12 rounded-full bg-brand px-8 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? "Bezig…" : "Opslaan"}
      </button>
    </form>
  );
}
