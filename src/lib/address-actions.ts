"use server";

import { fetchAddress, type AddressLookup } from "@/lib/pdok";
import { createClient } from "@/lib/supabase/server";

/** Alleen voor ingelogde partners, zodat de server geen open doorgeefluik naar PDOK is. */
export async function lookupAddress(postcode: string, houseNumber: number): Promise<AddressLookup> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { found: false };

  // PDOK_URL is alleen bedoeld voor tests met een nepserver.
  return fetchAddress(postcode, houseNumber, { url: process.env.PDOK_URL });
}
