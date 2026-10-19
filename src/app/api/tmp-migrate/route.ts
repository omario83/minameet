import { NextResponse, type NextRequest } from "next/server";
import { Client } from "pg";
import { STEP1, STEP2 } from "@/lib/tmp-migration-sql";

// Tijdelijk: voert de ontbrekende migraties 0003-0013 eenmalig uit. Wordt na gebruik verwijderd.
export const maxDuration = 120;

async function inTransaction(client: Client, sql: string) {
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  // Alleen wie de service-role-sleutel van dit project heeft, komt erdoor: Supabase zelf controleert de sleutel.
  const key = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const check = key
    ? await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    : null;
  if (!check?.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
  if (!url) return NextResponse.json({ error: "Geen POSTGRES_URL in deze omgeving" }, { status: 500 });

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const done: string[] = [];
  try {
    await client.connect();

    const hasDraft = await client.query("select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'vendor_status' and e.enumlabel = 'draft'");
    if (!hasDraft.rowCount) {
      await inTransaction(client, STEP1);
      done.push("stap1");
    }

    const hasTerms = await client.query("select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vendors' and column_name = 'terms_accepted_at'");
    if (!hasTerms.rowCount) {
      await inTransaction(client, STEP2);
      done.push("stap2");
    }

    return NextResponse.json({ ok: true, done });
  } catch (error) {
    return NextResponse.json({ ok: false, done, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally {
    await client.end().catch(() => undefined);
  }
}
