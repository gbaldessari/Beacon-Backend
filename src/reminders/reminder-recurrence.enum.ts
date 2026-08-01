export enum ReminderRecurrence {
  NONE = 'none',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum ReminderTimeMode {
  ALL_DAY = 'all_day',
  TIME = 'time',
  RANGE = 'range',
}

export enum ReminderNotifyUnit {
  HOURS = 'hours',
  DAYS = 'days',
}

/** Alcance de edición/eliminación de series (estilo Google Calendar). */
export enum ReminderEditScope {
  THIS = 'this',
  THIS_AND_FOLLOWING = 'this_and_following',
  ALL = 'all',
}
