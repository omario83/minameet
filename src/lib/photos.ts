export const PHOTO_BUCKET = "listing-photos";
export const MAX_PHOTOS = 8;
export const MIN_PHOTOS = 5;
export const MAX_PHOTO_MB = 10;

/** Publieke URL van een foto in Supabase Storage; `path` komt uit listings.photos. */
export function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

/** Herkent het echte bestandstype aan de eerste bytes, niet aan wat de browser opgeeft. */
export function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}
