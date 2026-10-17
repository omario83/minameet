export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string };

const LABELS: PasswordStrength["label"][] = ["Te kort", "Zwak", "Redelijk", "Goed", "Sterk"];

/** Richtlijn voor de gebruiker; de enige harde eis blijft de minimale lengte. */
export function passwordStrength(password: string, minLength = 10): PasswordStrength {
  if (password.length < minLength) return { score: 0, label: LABELS[0] };

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  let score = 1;
  if (password.length >= 14) score++;
  if (classes >= 3) score++;
  if (password.length >= 18 || (classes === 4 && password.length >= 14)) score++;

  // Herhaling ("aaaaaaaaaa") of een eenvoudige reeks is nooit meer dan zwak.
  if (/^(.)\1+$/.test(password) || /^(0123456789|1234567890|abcdefghij|qwertyuiop)/i.test(password)) score = 1;

  const clamped = Math.min(score, 4) as PasswordStrength["score"];
  return { score: clamped, label: LABELS[clamped] };
}
