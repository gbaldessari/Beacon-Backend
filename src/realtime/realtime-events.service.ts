import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  CalendarSyncPayload,
  FinanceSyncPayload,
  RealtimeEvents,
  UserListSyncPayload,
  calendarRoom,
  financeRoom,
  userRoom,
} from './realtime.events';

/**
 * Emisor de eventos en tiempo real hacia salas Socket.IO.
 *
 * El gateway asigna la instancia `Server` al arrancar.
 */
@Injectable()
export class RealtimeEventsService {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  emitCalendarSync(payload: CalendarSyncPayload): void {
    if (!this.server || !payload.calendarId) {
      return;
    }
    this.server
      .to(calendarRoom(payload.calendarId))
      .emit(RealtimeEvents.CALENDAR_SYNC, payload);
  }

  emitFinanceSync(payload: FinanceSyncPayload): void {
    if (!this.server || !payload.spaceId) {
      return;
    }
    this.server
      .to(financeRoom(payload.spaceId))
      .emit(RealtimeEvents.FINANCE_SYNC, payload);
  }

  emitUserCalendars(userId: string, payload: UserListSyncPayload): void {
    if (!this.server || !userId) {
      return;
    }
    this.server
      .to(userRoom(userId))
      .emit(RealtimeEvents.USER_CALENDARS, payload);
  }

  emitUserSpaces(userId: string, payload: UserListSyncPayload): void {
    if (!this.server || !userId) {
      return;
    }
    this.server.to(userRoom(userId)).emit(RealtimeEvents.USER_SPACES, payload);
  }

  emitUserReminders(userId: string, payload: UserListSyncPayload): void {
    if (!this.server || !userId) {
      return;
    }
    this.server
      .to(userRoom(userId))
      .emit(RealtimeEvents.USER_REMINDERS, payload);
  }

  /** Notifica a varios usuarios que su lista de calendarios cambió. */
  emitUserCalendarsMany(
    userIds: string[],
    payload: UserListSyncPayload,
  ): void {
    for (const userId of userIds) {
      this.emitUserCalendars(userId, payload);
    }
  }

  /** Notifica a varios usuarios que su lista de espacios cambió. */
  emitUserSpacesMany(userIds: string[], payload: UserListSyncPayload): void {
    for (const userId of userIds) {
      this.emitUserSpaces(userId, payload);
    }
  }

  emitUserRemindersMany(
    userIds: string[],
    payload: UserListSyncPayload,
  ): void {
    for (const userId of userIds) {
      this.emitUserReminders(userId, payload);
    }
  }
}
