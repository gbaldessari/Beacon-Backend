export enum NotificationType {
  REMINDER = 'reminder',
  CALENDAR_INVITE = 'calendar_invite',
  FINANCE_INVITE = 'finance_invite',
  SYSTEM = 'system',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
}

export enum NotificationDeliveryStatus {
  SENT = 'sent',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}
