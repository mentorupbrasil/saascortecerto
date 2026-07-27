export function parseWeekdays(allowedWeekdays: string): number[] {
  return allowedWeekdays.split(",").map((d) => parseInt(d.trim(), 10));
}

export function isWeekdayAllowed(date: Date, allowedWeekdays: string): boolean {
  const allowed = parseWeekdays(allowedWeekdays);
  return allowed.includes(date.getDay());
}
