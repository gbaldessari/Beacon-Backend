/** Eventos Socket.IO del namespace `/realtime`. */
export const RealtimeEvents = {
  CALENDAR_SYNC: 'calendar:sync',
  FINANCE_SYNC: 'finance:sync',
  USER_CALENDARS: 'user:calendars',
  USER_SPACES: 'user:spaces',
  USER_REMINDERS: 'user:reminders',
} as const;

export type CalendarSyncPayload = {
  calendarId: string;
  reason: string;
  actorId?: string;
};

export type FinanceSyncPayload = {
  spaceId: string;
  reason: string;
  actorId?: string;
};

export type UserListSyncPayload = {
  reason: string;
};

export function calendarRoom(calendarId: string): string {
  return `calendar:${calendarId}`;
}

export function financeRoom(spaceId: string): string {
  return `finance:${spaceId}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
