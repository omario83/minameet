"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { MAX_PHOTO_MB } from "@/lib/photos";
import { removeListingPhoto, uploadListingPhoto } from "@/lib/vendor-actions";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function PhotoManager({ listingId, photos, max, min }: { listingId: string; photos: { path: string; url: string }[]; max: number; min?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  // Eén foto per verzoek, na elkaar: de server werkt de fotolijst bij en parallelle verzoeken zouden elkaar overschrijven.
  async function upload(files: FileList | null) {
    if (!files?.length || progress) return;

    const issues: string[] = [];
    const queue = Array.from(files).filter((file) => {
      if (!ACCEPTED.includes(file.type)) issues.push(`${file.name}: alleen JPG, PNG of WebP`);
      else if (file.size > MAX_PHOTO_MB * 1024 * 1024) issues.push(`${file.name}: groter dan ${MAX_PHOTO_MB} MB`);
      else return true;
      return false;
    });

    const slots = max - photos.length;
    if (queue.length > slots) {
      issues.push(`Maximaal ${max} foto's per aanbod: ${queue.length - slots} bestand(en) overgeslagen`);
      queue.length = Math.max(slots, 0);
    }

    setProblems(issues);
    setProgress({ done: 0, total: queue.length });
    for (const [index, file] of queue.entries()) {
      const formData = new FormData();
      formData.set("listing_id", listingId);
      formData.set("photo", file);

      const result = await uploadListingPhoto(undefined, formData);
      if (result?.error) issues.push(`${file.name}: ${result.error}`);
      setProgress({ done: index + 1, total: queue.length });
      setProblems([...issues]);
    }
    setProgress(null);
    if (input.current) input.current.value = "";
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-display text-xl font-bold">Foto&apos;s</h2>
      <p className="mt-1 text-sm text-stone">
        De eerste foto is de hoofdfoto. JPG, PNG of WebP, maximaal {MAX_PHOTO_MB} MB per foto ({photos.length} van {max}). Je kunt er meerdere tegelijk kiezen.
        {min && (
          <strong className={photos.length >= min ? "text-st-won" : "text-st-todo"}> Minimaal {min} foto&apos;s nodig.</strong>
        )}
      </p>

      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.path} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand">
              <Image src={p.url} alt={`Foto ${i + 1}`} fill sizes="200px" className="object-cover" />
              {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-orange px-2.5 py-1 text-xs font-semibold text-ink">Hoofdfoto</span>}
              <form action={removeListingPhoto} className="absolute bottom-2 right-2">
                <input type="hidden" name="listing_id" value={listingId} />
                <input type="hidden" name="path" value={p.path} />
                <button className="rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-white hover:bg-st-lost">Verwijder</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {photos.length < max && (
        <div className="mt-4">
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPTED.join(",")}
            disabled={!!progress}
            aria-label="Foto's kiezen"
            onChange={(e) => upload(e.target.files)}
            className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:font-semibold hover:file:bg-brand-soft disabled:opacity-60"
          />
        </div>
      )}

      {progress && (
        <p role="status" className="mt-3 text-sm font-medium text-ink/70">
          Uploaden… {progress.done} van {progress.total}
        </p>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 text-sm font-medium text-st-lost">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
