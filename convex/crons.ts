import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Quiet hours in the Philippines (UTC+8).
crons.daily("clean up orphaned uploads", { hourUTC: 19, minuteUTC: 0 }, internal.maintenance.cleanupOrphanedFiles, {});
crons.weekly(
  "purge archived messages older than a year",
  { dayOfWeek: "sunday", hourUTC: 19, minuteUTC: 30 },
  internal.maintenance.purgeOldArchivedMessages,
  {},
);

export default crons;
