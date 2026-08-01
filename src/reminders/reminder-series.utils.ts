import { Reminder } from './entities/reminder.entity';
import { ReminderRecurrence } from './reminder-recurrence.enum';

const pad2 = (value: number) => String(value).padStart(2, '0');

export const formatDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const parseDateKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const addDaysToKey = (key: string, amount: number): string => {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + amount);
  return formatDateKey(date);
};

export const dayBeforeKey = (key: string): string => addDaysToKey(key, -1);

export const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Primera fecha incluida de la serie. */
export const getSeriesStartKey = (reminder: Reminder): string => {
  if (reminder.series_start) {
    return reminder.series_start;
  }
  return formatDateKey(new Date(reminder.created_at));
};

/** True si D está dentro del rango activo de la serie (sin mirar weekdays). */
export const isDateInSeriesWindow = (
  reminder: Reminder,
  dateKey: string,
): boolean => {
  const start = getSeriesStartKey(reminder);
  if (dateKey < start) {
    return false;
  }
  if (reminder.series_until && dateKey > reminder.series_until) {
    return false;
  }
  return true;
};

export const matchesRecurrencePattern = (
  reminder: Reminder,
  date: Date,
): boolean => {
  const dateKey = formatDateKey(date);
  if (!isDateInSeriesWindow(reminder, dateKey)) {
    return false;
  }

  switch (reminder.recurrence_type) {
    case ReminderRecurrence.WEEKLY:
      return (reminder.weekdays ?? []).includes(date.getDay());
    case ReminderRecurrence.MONTHLY: {
      if (!reminder.day_of_month) {
        return false;
      }
      const lastDay = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
      ).getDate();
      const target = Math.min(reminder.day_of_month, lastDay);
      return date.getDate() === target;
    }
    case ReminderRecurrence.YEARLY: {
      if (!reminder.day_of_month || !reminder.month_of_year) {
        return false;
      }
      if (date.getMonth() + 1 !== reminder.month_of_year) {
        return false;
      }
      const lastDay = new Date(
        date.getFullYear(),
        reminder.month_of_year,
        0,
      ).getDate();
      const target = Math.min(reminder.day_of_month, lastDay);
      return date.getDate() === target;
    }
    default:
      return false;
  }
};

export const eachDateKeyInRange = (from: string, to: string): string[] => {
  const keys: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    keys.push(cursor);
    cursor = addDaysToKey(cursor, 1);
    if (keys.length > 800) {
      break;
    }
  }
  return keys;
};
