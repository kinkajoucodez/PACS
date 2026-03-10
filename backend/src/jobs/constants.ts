/** Default SLA turnaround time (in hours) for each study priority level. */
export const DEFAULT_SLA_HOURS: Record<string, number> = {
  stat: parseInt(process.env.SLA_STAT_HOURS || '1', 10),
  urgent: parseInt(process.env.SLA_URGENT_HOURS || '4', 10),
  routine: parseInt(process.env.SLA_ROUTINE_HOURS || '24', 10),
  follow_up: parseInt(process.env.SLA_FOLLOW_UP_HOURS || '48', 10),
};

/**
 * Default warning threshold as a fraction of total SLA time.
 * A warning notification is sent when this fraction of the allowed time has elapsed.
 */
export const DEFAULT_WARNING_THRESHOLD_PERCENT = parseInt(
  process.env.SLA_WARNING_THRESHOLD_PERCENT || '75',
  10,
);

/**
 * Thresholds (in minutes) after which an unassigned study is escalated.
 * Used by the auto-assignment engine when no radiologist is available.
 */
export const ESCALATION_UNASSIGNED_MINUTES: Record<string, number> = {
  stat: parseInt(process.env.ESCALATION_UNASSIGNED_STAT_MINUTES || '30', 10),
  urgent: parseInt(process.env.ESCALATION_UNASSIGNED_URGENT_MINUTES || '120', 10),
  routine: parseInt(process.env.ESCALATION_UNASSIGNED_ROUTINE_MINUTES || '720', 10),
  follow_up: parseInt(process.env.ESCALATION_UNASSIGNED_FOLLOW_UP_MINUTES || '1440', 10),
};

/** Cron expression for the SLA monitoring job. Defaults to every 5 minutes. */
export const SLA_CRON_SCHEDULE =
  process.env.SLA_CRON_SCHEDULE || '*/5 * * * *';

/** Cron expression for the auto-assignment job. Defaults to every 3 minutes. */
export const AUTO_ASSIGN_CRON_SCHEDULE =
  process.env.AUTO_ASSIGN_CRON_SCHEDULE || '*/3 * * * *';

/** Study statuses that indicate the study workflow is complete (no SLA action needed). */
export const TERMINAL_STUDY_STATUSES = ['reported', 'verified', 'amended'] as const;

/** Assignment statuses that represent an active (non-completed) assignment. */
export const ACTIVE_ASSIGNMENT_STATUSES = [
  'pending',
  'accepted',
  'in_progress',
] as const;

/** Milliseconds per minute — used for threshold calculations. */
export const MS_PER_MINUTE = 60_000;
