// A due date is a day, not a time. UTC midnight lets the existing DateTime
// column store it without changing which calendar date the frontend displays.
export function parseDueDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return undefined;

  const date = new Date(`${value}T00:00:00.000Z`);
  // JavaScript rolls February 30 into March. Comparing back to the input
  // rejects that rollover as well as malformed and out-of-range dates.
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return undefined;
  }
  return date;
}
