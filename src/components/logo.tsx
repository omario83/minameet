import { useId } from "react";

/** Twee cirkels die elkaar ontmoeten; de overlap vormt een "M". */
export function LogoMark({ className = "h-8" }: { className?: string }) {
  const id = useId();

  return (
    <svg viewBox="3 2 42 28" className={className} role="img" aria-label="MinaMeet">
      <defs>
        <clipPath id={id}>
          <circle cx="31" cy="16" r="14" />
        </clipPath>
      </defs>
      <circle cx="17" cy="16" r="14" fill="#FF8A00" />
      <circle cx="31" cy="16" r="14" fill="#FFB400" />
      <circle cx="17" cy="16" r="14" fill="#C8410B" clipPath={`url(#${id})`} />
    </svg>
  );
}

/** `onDark` voor gebruik op foto's en donkere vlakken. */
export function Logo({ onDark = false, className = "" }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-7" />
      <span className={`font-display text-2xl font-bold tracking-tight ${onDark ? "text-white" : "text-ink"}`}>
        Mina<span className={onDark ? "text-gold" : "text-brand"}>Meet</span>
      </span>
    </span>
  );
}
