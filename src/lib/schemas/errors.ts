import type { z } from "zod";

/** Eerste foutmelding per veld. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in result)) result[key] = issue.message;
  }
  return result;
}
