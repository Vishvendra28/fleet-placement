export const SCHEDULE_TIMES: Record<string, string> = {
  "Schedule-1Way": "06:00",
  "Schedule-2Way": "18:00",
  "Adhoc": "09:00",
};

export const SCHEDULE_OPTIONS = ["Schedule-1Way", "Schedule-2Way", "Adhoc"];

// Cohort values vary by entry point: "Schedule-2Way" (new placement form),
// "SCH 02 Way" (master route admin page). Both must be treated as 2-way.
export function is2WaySchedule(cohort: string): boolean {
  const c = cohort.toLowerCase().replace(/[-_ ]+/g, "");
  // matches: "schedule2way", "sch02way", "2way", "02way", etc.
  return c.includes("2way") || c.includes("02way");
}
