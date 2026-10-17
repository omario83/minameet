export const inputClass =
  "h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-st-lost">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-ink/50">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function FormStatus({ state }: { state: { error?: string; message?: string } | undefined }) {
  if (state?.error) return <p role="alert" className="text-sm font-medium text-st-lost">{state.error}</p>;
  if (state?.message) return <p role="status" className="text-sm font-medium text-st-won">{state.message}</p>;
  return null;
}
