"use client";

import { useActionState } from "react";
import { Bell } from "lucide-react";
import { FormStatus } from "@/components/form-ui";
import { sendReminder } from "@/lib/crm-actions";

export function ReminderButton({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(sendReminder, undefined);

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="quote_id" value={quoteId} />
      <button disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-full bg-st-sent px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
        <Bell className="size-4" /> {pending ? "Bezig…" : "Herinnering sturen"}
      </button>
      <FormStatus state={state} />
    </form>
  );
}
