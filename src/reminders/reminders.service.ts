import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateReminderDto,
  SetReminderCompletionDto,
  UpdateReminderDto,
} from './dto/reminder.dto';
import { ReminderCompletion } from './entities/reminder-completion.entity';
import { Reminder } from './entities/reminder.entity';
import {
  ReminderNotifyUnit,
  ReminderRecurrence,
  ReminderTimeMode,
} from './reminder-recurrence.enum';

export type ReminderView = {
  id: string;
  title: string;
  description: string | null;
  repeats: boolean;
  recurrenceType: ReminderRecurrence;
  scheduledDate: string | null;
  weekdays: number[] | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  timeMode: ReminderTimeMode;
  startTime: string | null;
  endTime: string | null;
  notifyEnabled: boolean;
  notifyValue: number | null;
  notifyUnit: ReminderNotifyUnit | null;
  completed: boolean;
  completionCount: number;
  nextOccurrenceAt: string | null;
  notifyAt: string | null;
  lastCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpcomingReminderView = ReminderView & {
  isOverdue: boolean;
  isNotifyActive: boolean;
  isDueToday: boolean;
};

export type ReminderCompletionView = {
  id: string;
  reminderId: string;
  completedAt: string;
  occurrenceDate: string | null;
};

type ScheduleFields = {
  recurrenceType: ReminderRecurrence;
  scheduledDate: string | null;
  weekdays: number[] | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  timeMode: ReminderTimeMode;
  startTime: string | null;
  endTime: string | null;
  notifyEnabled: boolean;
  notifyValue: number | null;
  notifyUnit: ReminderNotifyUnit | null;
};

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Reminder)
    private readonly remindersRepository: Repository<Reminder>,
    @InjectRepository(ReminderCompletion)
    private readonly completionsRepository: Repository<ReminderCompletion>,
  ) {}

  async listForUser(
    userId: string,
    timeZone = 'UTC',
  ): Promise<ReminderView[]> {
    const reminders = await this.remindersRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    return Promise.all(
      reminders.map((reminder) => this.toView(reminder, timeZone)),
    );
  }

  async listUpcoming(
    userId: string,
    timeZone = 'UTC',
  ): Promise<UpcomingReminderView[]> {
    const safeTimeZone = this.resolveTimeZone(timeZone);
    const now = new Date();
    const todayParts = this.getZonedDateParts(now, safeTimeZone);
    const views = await this.listForUser(userId, safeTimeZone);

    return views
      .map((reminder) => {
        const next = reminder.nextOccurrenceAt
          ? new Date(reminder.nextOccurrenceAt)
          : null;
        const notifyAt = reminder.notifyAt ? new Date(reminder.notifyAt) : null;

        const isDueToday =
          !reminder.completed &&
          this.isReminderDueOnDate(reminder, todayParts);

        const isNotifyActive =
          !reminder.completed &&
          !!notifyAt &&
          !!next &&
          notifyAt.getTime() <= now.getTime() &&
          next.getTime() >= now.getTime();

        const isOverdue =
          !reminder.completed &&
          !!next &&
          next.getTime() < now.getTime() &&
          isDueToday;

        return {
          ...reminder,
          isOverdue,
          isNotifyActive,
          isDueToday,
          _include: isDueToday || isNotifyActive,
          _sort:
            (isDueToday ? 0 : 1) * 1_000_000_000_000 +
            (next?.getTime() ?? Number.MAX_SAFE_INTEGER),
        };
      })
      .filter((item) => item._include)
      .sort((a, b) => a._sort - b._sort)
      .map(({ _include: _a, _sort: _b, ...reminder }) => reminder);
  }

  async listCompletions(
    userId: string,
    reminderId: string,
  ): Promise<ReminderCompletionView[]> {
    await this.findOwnedOrFail(userId, reminderId);

    const completions = await this.completionsRepository.find({
      where: { reminder_id: reminderId, user_id: userId },
      order: { completed_at: 'DESC' },
    });

    return completions.map((completion) => ({
      id: completion.id,
      reminderId: completion.reminder_id,
      completedAt: completion.completed_at.toISOString(),
      occurrenceDate: completion.occurrence_date,
    }));
  }

  async create(userId: string, dto: CreateReminderDto): Promise<ReminderView> {
    const schedule = this.normalizeSchedule(dto);

    const reminder = this.remindersRepository.create({
      user_id: userId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      recurrence_type: schedule.recurrenceType,
      scheduled_date: schedule.scheduledDate,
      weekdays: schedule.weekdays,
      day_of_month: schedule.dayOfMonth,
      month_of_year: schedule.monthOfYear,
      time_mode: schedule.timeMode,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      notify_enabled: schedule.notifyEnabled,
      notify_value: schedule.notifyValue,
      notify_unit: schedule.notifyUnit,
      last_completed_at: null,
    });

    const saved = await this.remindersRepository.save(reminder);
    return this.toView(saved);
  }

  async update(
    userId: string,
    reminderId: string,
    dto: UpdateReminderDto,
  ): Promise<ReminderView> {
    const reminder = await this.findOwnedOrFail(userId, reminderId);

    if (dto.title !== undefined) {
      reminder.title = dto.title.trim();
    }

    if (dto.description !== undefined) {
      reminder.description = dto.description?.trim() || null;
    }

    const repeats =
      dto.repeats ?? reminder.recurrence_type !== ReminderRecurrence.NONE;

    const schedule = this.normalizeSchedule({
      repeats,
      recurrenceType:
        dto.recurrenceType ??
        (repeats ? reminder.recurrence_type : ReminderRecurrence.NONE),
      scheduledDate:
        dto.scheduledDate ?? reminder.scheduled_date ?? undefined,
      weekdays: dto.weekdays ?? reminder.weekdays ?? undefined,
      dayOfMonth: dto.dayOfMonth ?? reminder.day_of_month ?? undefined,
      monthOfYear: dto.monthOfYear ?? reminder.month_of_year ?? undefined,
      timeMode: dto.timeMode ?? reminder.time_mode,
      startTime: dto.startTime ?? reminder.start_time ?? undefined,
      endTime: dto.endTime ?? reminder.end_time ?? undefined,
      notifyEnabled: dto.notifyEnabled ?? reminder.notify_enabled,
      notifyValue: dto.notifyValue ?? reminder.notify_value ?? undefined,
      notifyUnit: dto.notifyUnit ?? reminder.notify_unit ?? undefined,
    });

    reminder.recurrence_type = schedule.recurrenceType;
    reminder.scheduled_date = schedule.scheduledDate;
    reminder.weekdays = schedule.weekdays;
    reminder.day_of_month = schedule.dayOfMonth;
    reminder.month_of_year = schedule.monthOfYear;
    reminder.time_mode = schedule.timeMode;
    reminder.start_time = schedule.startTime;
    reminder.end_time = schedule.endTime;
    reminder.notify_enabled = schedule.notifyEnabled;
    reminder.notify_value = schedule.notifyValue;
    reminder.notify_unit = schedule.notifyUnit;

    const saved = await this.remindersRepository.save(reminder);
    return this.toView(saved);
  }

  async setCompletion(
    userId: string,
    reminderId: string,
    dto: SetReminderCompletionDto,
    timeZone = 'UTC',
  ): Promise<ReminderView> {
    const safeTimeZone = this.resolveTimeZone(timeZone);
    const reminder = await this.findOwnedOrFail(userId, reminderId);
    const currentlyCompleted = this.isCompletedForCurrentPeriod(
      reminder,
      safeTimeZone,
    );
    const nextCompleted =
      typeof dto.completed === 'boolean' ? dto.completed : !currentlyCompleted;

    if (nextCompleted && !currentlyCompleted) {
      const completedAt = new Date();
      const occurrenceDate = this.resolveOccurrenceDate(reminder, completedAt);

      await this.completionsRepository.save(
        this.completionsRepository.create({
          reminder_id: reminder.id,
          user_id: userId,
          completed_at: completedAt,
          occurrence_date: occurrenceDate,
        }),
      );

      reminder.last_completed_at = completedAt;
    }

    if (!nextCompleted && currentlyCompleted) {
      await this.removeCurrentPeriodCompletion(reminder, userId, safeTimeZone);
      const latest = await this.completionsRepository.findOne({
        where: { reminder_id: reminder.id, user_id: userId },
        order: { completed_at: 'DESC' },
      });
      reminder.last_completed_at = latest?.completed_at ?? null;
    }

    const saved = await this.remindersRepository.save(reminder);
    return this.toView(saved, safeTimeZone);
  }

  async remove(userId: string, reminderId: string): Promise<void> {
    const reminder = await this.findOwnedOrFail(userId, reminderId);
    await this.remindersRepository.remove(reminder);
  }

  private async findOwnedOrFail(
    userId: string,
    reminderId: string,
  ): Promise<Reminder> {
    const reminder = await this.remindersRepository.findOne({
      where: { id: reminderId },
    });

    if (!reminder) {
      throw new NotFoundException('Recordatorio no encontrado.');
    }

    if (reminder.user_id !== userId) {
      throw new ForbiddenException('No tienes acceso a este recordatorio.');
    }

    return reminder;
  }

  private normalizeSchedule(input: {
    repeats: boolean;
    recurrenceType?: ReminderRecurrence;
    scheduledDate?: string;
    weekdays?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
    timeMode: ReminderTimeMode;
    startTime?: string;
    endTime?: string;
    notifyEnabled: boolean;
    notifyValue?: number;
    notifyUnit?: ReminderNotifyUnit;
  }): ScheduleFields {
    const time = this.normalizeTime(
      input.timeMode,
      input.startTime,
      input.endTime,
    );
    const notify = this.normalizeNotify(
      input.notifyEnabled,
      input.notifyValue,
      input.notifyUnit,
    );

    if (!input.repeats) {
      if (!input.scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledDate)) {
        throw new BadRequestException(
          'Selecciona una fecha para tareas sin repetición.',
        );
      }

      return {
        recurrenceType: ReminderRecurrence.NONE,
        scheduledDate: input.scheduledDate,
        weekdays: null,
        dayOfMonth: null,
        monthOfYear: null,
        ...time,
        ...notify,
      };
    }

    const recurrenceType = input.recurrenceType;
    if (
      !recurrenceType ||
      recurrenceType === ReminderRecurrence.NONE
    ) {
      throw new BadRequestException(
        'Selecciona un tipo de repetición (semanal, mensual o anual).',
      );
    }

    const type =
      (recurrenceType as string) === 'daily'
        ? ReminderRecurrence.WEEKLY
        : recurrenceType;

    switch (type) {
      case ReminderRecurrence.WEEKLY: {
        const weekdays = this.uniqueSortedWeekdays(input.weekdays);
        if (weekdays.length === 0) {
          throw new BadRequestException(
            'Selecciona al menos un día de la semana.',
          );
        }
        return {
          recurrenceType: ReminderRecurrence.WEEKLY,
          scheduledDate: null,
          weekdays,
          dayOfMonth: null,
          monthOfYear: null,
          ...time,
          ...notify,
        };
      }
      case ReminderRecurrence.MONTHLY: {
        if (
          input.dayOfMonth === undefined ||
          input.dayOfMonth === null ||
          input.dayOfMonth < 1 ||
          input.dayOfMonth > 31
        ) {
          throw new BadRequestException(
            'Indica un día del mes válido (1–31).',
          );
        }
        return {
          recurrenceType: ReminderRecurrence.MONTHLY,
          scheduledDate: null,
          weekdays: null,
          dayOfMonth: input.dayOfMonth,
          monthOfYear: null,
          ...time,
          ...notify,
        };
      }
      case ReminderRecurrence.YEARLY: {
        if (
          input.dayOfMonth === undefined ||
          input.dayOfMonth === null ||
          input.dayOfMonth < 1 ||
          input.dayOfMonth > 31
        ) {
          throw new BadRequestException(
            'Indica un día del mes válido (1–31).',
          );
        }
        if (
          input.monthOfYear === undefined ||
          input.monthOfYear === null ||
          input.monthOfYear < 1 ||
          input.monthOfYear > 12
        ) {
          throw new BadRequestException('Indica un mes válido (1–12).');
        }
        return {
          recurrenceType: ReminderRecurrence.YEARLY,
          scheduledDate: null,
          weekdays: null,
          dayOfMonth: input.dayOfMonth,
          monthOfYear: input.monthOfYear,
          ...time,
          ...notify,
        };
      }
      default:
        throw new BadRequestException('Tipo de repetición no válido.');
    }
  }

  private normalizeTime(
    timeMode: ReminderTimeMode,
    startTime?: string,
    endTime?: string,
  ): Pick<ScheduleFields, 'timeMode' | 'startTime' | 'endTime'> {
    if (timeMode === ReminderTimeMode.ALL_DAY) {
      return { timeMode, startTime: null, endTime: null };
    }

    if (!startTime || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(startTime)) {
      throw new BadRequestException('Indica una hora de inicio válida (HH:mm).');
    }

    if (timeMode === ReminderTimeMode.TIME) {
      return { timeMode, startTime, endTime: null };
    }

    if (!endTime || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(endTime)) {
      throw new BadRequestException('Indica una hora de fin válida (HH:mm).');
    }

    if (this.timeToMinutes(endTime) <= this.timeToMinutes(startTime)) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la de inicio.',
      );
    }

    return { timeMode, startTime, endTime };
  }

  private normalizeNotify(
    notifyEnabled: boolean,
    notifyValue?: number,
    notifyUnit?: ReminderNotifyUnit,
  ): Pick<ScheduleFields, 'notifyEnabled' | 'notifyValue' | 'notifyUnit'> {
    if (!notifyEnabled) {
      return { notifyEnabled: false, notifyValue: null, notifyUnit: null };
    }

    if (!notifyValue || notifyValue < 1) {
      throw new BadRequestException(
        'Indica cuánto tiempo antes quieres el aviso.',
      );
    }

    if (
      notifyUnit !== ReminderNotifyUnit.HOURS &&
      notifyUnit !== ReminderNotifyUnit.DAYS
    ) {
      throw new BadRequestException('Unidad de aviso no válida.');
    }

    return { notifyEnabled: true, notifyValue, notifyUnit };
  }

  private uniqueSortedWeekdays(weekdays?: number[]): number[] {
    if (!weekdays?.length) {
      return [];
    }

    return [...new Set(weekdays)]
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private isCompletedForCurrentPeriod(
    reminder: Reminder,
    timeZone = 'UTC',
  ): boolean {
    if (!reminder.last_completed_at) {
      return false;
    }

    const completedAt = new Date(reminder.last_completed_at);
    const now = new Date();
    const completedParts = this.getZonedDateParts(completedAt, timeZone);
    const nowParts = this.getZonedDateParts(now, timeZone);

    switch (reminder.recurrence_type) {
      case ReminderRecurrence.NONE:
        return true;
      case ReminderRecurrence.WEEKLY:
        return completedParts.date === nowParts.date;
      case ReminderRecurrence.MONTHLY:
        return (
          completedParts.year === nowParts.year &&
          completedParts.month === nowParts.month
        );
      case ReminderRecurrence.YEARLY:
        return completedParts.year === nowParts.year;
      default:
        return false;
    }
  }

  private getNextOccurrence(
    reminder: Reminder,
    from = new Date(),
    timeZone = 'UTC',
  ): Date | null {
    const cursor = new Date(from);
    const safeTimeZone = this.resolveTimeZone(timeZone);

    if (reminder.recurrence_type === ReminderRecurrence.NONE) {
      if (!reminder.scheduled_date) {
        return null;
      }
      const occurrence = this.combineDateAndTime(
        reminder.scheduled_date,
        reminder,
      );
      if (
        this.isCompletedForCurrentPeriod(reminder, safeTimeZone) &&
        occurrence <= from
      ) {
        return null;
      }
      return occurrence;
    }

    for (let i = 0; i < 400; i += 1) {
      const candidateDate = this.addDays(this.startOfDay(cursor), i);
      if (!this.matchesRecurrenceDate(reminder, candidateDate)) {
        continue;
      }

      const occurrence = this.combineDateAndTime(
        this.formatDate(candidateDate),
        reminder,
      );

      if (occurrence.getTime() >= from.getTime() - 60 * 1000) {
        if (
          reminder.recurrence_type === ReminderRecurrence.WEEKLY &&
          this.isCompletedForCurrentPeriod(reminder, safeTimeZone) &&
          this.isSameCalendarDay(occurrence, from)
        ) {
          continue;
        }
        if (
          reminder.recurrence_type === ReminderRecurrence.MONTHLY &&
          this.isCompletedForCurrentPeriod(reminder, safeTimeZone) &&
          occurrence.getMonth() === from.getMonth() &&
          occurrence.getFullYear() === from.getFullYear()
        ) {
          continue;
        }
        if (
          reminder.recurrence_type === ReminderRecurrence.YEARLY &&
          this.isCompletedForCurrentPeriod(reminder, safeTimeZone) &&
          occurrence.getFullYear() === from.getFullYear()
        ) {
          continue;
        }
        return occurrence;
      }
    }

    return null;
  }

  private matchesRecurrenceDate(reminder: Reminder, date: Date): boolean {
    switch (reminder.recurrence_type) {
      case ReminderRecurrence.WEEKLY:
        return (reminder.weekdays ?? []).includes(date.getDay());
      case ReminderRecurrence.MONTHLY:
        return date.getDate() === reminder.day_of_month;
      case ReminderRecurrence.YEARLY:
        return (
          date.getDate() === reminder.day_of_month &&
          date.getMonth() + 1 === reminder.month_of_year
        );
      default:
        return false;
    }
  }

  private combineDateAndTime(dateStr: string, reminder: Reminder): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (
      reminder.time_mode === ReminderTimeMode.TIME ||
      reminder.time_mode === ReminderTimeMode.RANGE
    ) {
      const [hours, minutes] = (reminder.start_time ?? '00:00')
        .split(':')
        .map(Number);
      date.setHours(hours, minutes, 0, 0);
    }

    return date;
  }

  private getNotifyAt(reminder: Reminder, occurrence: Date | null): Date | null {
    if (
      !occurrence ||
      !reminder.notify_enabled ||
      !reminder.notify_value ||
      !reminder.notify_unit
    ) {
      return null;
    }

    const ms =
      reminder.notify_unit === ReminderNotifyUnit.DAYS
        ? reminder.notify_value * 24 * 60 * 60 * 1000
        : reminder.notify_value * 60 * 60 * 1000;

    return new Date(occurrence.getTime() - ms);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private isSameCalendarDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private resolveOccurrenceDate(reminder: Reminder, at: Date): string {
    if (
      reminder.recurrence_type === ReminderRecurrence.NONE &&
      reminder.scheduled_date
    ) {
      return reminder.scheduled_date;
    }

    return this.formatDate(at);
  }

  private async removeCurrentPeriodCompletion(
    reminder: Reminder,
    userId: string,
    timeZone = 'UTC',
  ): Promise<void> {
    const completions = await this.completionsRepository.find({
      where: { reminder_id: reminder.id, user_id: userId },
      order: { completed_at: 'DESC' },
    });

    const currentPeriodCompletion = completions.find((completion) =>
      this.completionBelongsToCurrentPeriod(
        reminder,
        completion.completed_at,
        timeZone,
      ),
    );

    if (currentPeriodCompletion) {
      await this.completionsRepository.remove(currentPeriodCompletion);
    }
  }

  private completionBelongsToCurrentPeriod(
    reminder: Reminder,
    completedAt: Date,
    timeZone = 'UTC',
  ): boolean {
    const now = new Date();
    const completedParts = this.getZonedDateParts(completedAt, timeZone);
    const nowParts = this.getZonedDateParts(now, timeZone);

    switch (reminder.recurrence_type) {
      case ReminderRecurrence.NONE:
        return true;
      case ReminderRecurrence.WEEKLY:
        return completedParts.date === nowParts.date;
      case ReminderRecurrence.MONTHLY:
        return (
          completedParts.year === nowParts.year &&
          completedParts.month === nowParts.month
        );
      case ReminderRecurrence.YEARLY:
        return completedParts.year === nowParts.year;
      default:
        return false;
    }
  }

  private resolveTimeZone(timeZone?: string): string {
    const candidate = (timeZone || 'UTC').trim();
    try {
      Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
      return candidate;
    } catch {
      return 'UTC';
    }
  }

  private getZonedDateParts(
    date: Date,
    timeZone: string,
  ): {
    date: string;
    year: number;
    month: number;
    day: number;
    weekday: number;
  } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(date);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';

    const year = Number(get('year'));
    const month = Number(get('month'));
    const day = Number(get('day'));
    const weekdayLabel = get('weekday');
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      year,
      month,
      day,
      weekday: weekdayMap[weekdayLabel] ?? 0,
    };
  }

  private isReminderDueOnDate(
    reminder: ReminderView,
    today: { date: string; year: number; month: number; day: number; weekday: number },
  ): boolean {
    switch (reminder.recurrenceType) {
      case ReminderRecurrence.NONE:
        return reminder.scheduledDate === today.date;
      case ReminderRecurrence.WEEKLY:
        return (reminder.weekdays ?? []).includes(today.weekday);
      case ReminderRecurrence.MONTHLY:
        return reminder.dayOfMonth === today.day;
      case ReminderRecurrence.YEARLY:
        return (
          reminder.dayOfMonth === today.day &&
          reminder.monthOfYear === today.month
        );
      default:
        return false;
    }
  }

  private async toView(
    reminder: Reminder,
    timeZone = 'UTC',
  ): Promise<ReminderView> {
    if ((reminder.recurrence_type as string) === 'daily') {
      reminder.recurrence_type = ReminderRecurrence.WEEKLY;
    }

    const safeTimeZone = this.resolveTimeZone(timeZone);
    const nextOccurrence = this.getNextOccurrence(
      reminder,
      new Date(),
      safeTimeZone,
    );
    const notifyAt = this.getNotifyAt(reminder, nextOccurrence);
    const completionCount = await this.completionsRepository.count({
      where: { reminder_id: reminder.id },
    });

    return {
      id: reminder.id,
      title: reminder.title,
      description: reminder.description,
      repeats: reminder.recurrence_type !== ReminderRecurrence.NONE,
      recurrenceType: reminder.recurrence_type,
      scheduledDate: reminder.scheduled_date,
      weekdays: reminder.weekdays,
      dayOfMonth: reminder.day_of_month,
      monthOfYear: reminder.month_of_year,
      timeMode: reminder.time_mode ?? ReminderTimeMode.ALL_DAY,
      startTime: reminder.start_time,
      endTime: reminder.end_time,
      notifyEnabled: reminder.notify_enabled ?? false,
      notifyValue: reminder.notify_value,
      notifyUnit: reminder.notify_unit,
      completed: this.isCompletedForCurrentPeriod(reminder, safeTimeZone),
      completionCount,
      nextOccurrenceAt: nextOccurrence ? nextOccurrence.toISOString() : null,
      notifyAt: notifyAt ? notifyAt.toISOString() : null,
      lastCompletedAt: reminder.last_completed_at
        ? reminder.last_completed_at.toISOString()
        : null,
      createdAt: reminder.created_at.toISOString(),
      updatedAt: reminder.updated_at.toISOString(),
    };
  }
}
