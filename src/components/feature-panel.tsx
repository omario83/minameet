import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Slideshow } from "@/components/slideshow";

export function FeaturePanel({
  href,
  title,
  text,
  cta,
  slides,
  gradient,
  interval,
}: {
  href: string;
  title: string;
  text: string;
  cta: string;
  slides: string[];
  gradient: string;
  interval?: number;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex min-h-[28rem] flex-1 overflow-hidden rounded-[2rem] bg-gradient-to-br ${gradient} text-white transition-[flex-grow] duration-700 md:h-[36rem] md:hover:flex-[1.35]`}
    >
      <Slideshow slides={slides} interval={interval} sizes="(min-width: 768px) 40vw, 100vw" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/10" />
      <div aria-hidden className="absolute inset-0 bg-tangerine/10 mix-blend-multiply" />

      <div className="relative mt-auto w-full p-7 sm:p-9">
        <Reveal>
          <h3 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h3>
        </Reveal>
        <Reveal delay={150}>
          <p className="mt-3 max-w-sm text-white/85">{text}</p>
        </Reveal>
        <Reveal delay={300}>
          <span className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-orange px-6 font-semibold text-ink transition group-hover:bg-gold">
            {cta} <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </Reveal>
      </div>
    </Link>
  );
}
