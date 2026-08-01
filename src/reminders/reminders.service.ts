import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CreateReminderDto,
  SetReminderCompletionDto,
  UpdateReminderDto,
} from './dto/reminder.dto';
import { ReminderCompletion } from './entities/reminder-completion.entity';
import { ReminderException } from './entities/reminder-exception.entity';
import { Reminder } from './entities/reminder.entity';
import {
  ReminderEditScope,
  ReminderNotifyUnit,
  ReminderRecurrence,
  ReminderTimeMode,
} from './reminder-recurrence.enum';
import {
  dayBeforeKey,
  eachDateKeyInRange,
  formatDateKey,
  getSeriesStartKey,
  matchesRecurrencePattern,
  parseDateKey,
} from './reminder-series.utils';

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
  seriesId: string | null;
  seriesStart: string | null;
  seriesUntil: string | null;
  originalOccurrenceDate: string | null;
  isOverride: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReminderOccurrenceView = {
  reminderId: string;
  seriesId: string | null;
  date: string;
  title: string;
  description: string | null;
  repeats: boolean;
  recurrenceType: ReminderRecurrence;
  timeMode: ReminderTimeMode;
  startTime: string | null;
  endTime: string | null;
  isOverride: boolean;
  completed: boolean;
  reminder: ReminderView;
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
    @InjectRepository(ReminderException)
    private readonly exceptionsRepository: Repository<ReminderException>,
  ) {}

  async listForUser(
    userId: string,
    timeZone = 'UTC',
  ): Promise<ReminderView[]> {
    const reminders = await this.remindersRepository.find({
      where: { user_id: userId, is_override: false },
      order: { created_at: 'DESC' },
    });

    return Promise.all(
      reminders.map((reminder) => this.toView(reminder, timeZone)),
    );
  }

  async listOccurrences(
    userId: string,
    from?: string,
    to?: string,
    timeZone = 'UTC',
  ): Promise<ReminderOccurrenceView[]> {
    if (
      !from ||
      !to ||
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      from > to
    ) {
      throw new BadRequestException(
        'Indica un rango from/to válido (YYYY-MM-DD).',
      );
    }

    const safeTimeZone = this.resolveTimeZone(timeZone);
    const reminders = await this.remindersRepository.find({
      where: { user_id: userId },
    });
    const masters = reminders.filter((item) => !item.is_override);
    const overrides = reminders.filter((item) => item.is_override);
    const masterIds = masters.map((item) => item.id);

    const exceptions =
      masterIds.length === 0
        ? []
        : await this.exceptionsRepository.find({
            where: { reminder_id: In(masterIds), user_id: userId },
          });

    const exceptionSet = new Set(
      exceptions.map((item) => `${item.reminder_id}:${item.occurrence_date}`),
    );
    const overrideByOriginal = new Map<string, Reminder>();
    for (const override of overrides) {
      if (override.series_id && override.original_occurrence_date) {
        overrideByOriginal.set(
          `${override.series_id}:${override.original_occurrence_date}`,
          override,
        );
      }
    }

    const completions = await this.completionsRepository.find({
      where: { user_id: userId },
    });
    const completedSet = new Set(
      completions
        .filter((item) => item.occurrence_date)
        .map((item) => `${item.reminder_id}:${item.occurrence_date}`),
    );

    const viewsById = new Map<string, ReminderView>();
    await Promise.all(
      reminders.map(async (reminder) => {
        viewsById.set(reminder.id, await this.toView(reminder, safeTimeZone));
      }),
    );

    const results: ReminderOccurrenceView[] = [];
    const dateKeys = eachDateKeyInRange(from, to);

    for (const dateKey of dateKeys) {
      const date = parseDateKey(dateKey);

      for (const master of masters) {
        if (master.recurrence_type === ReminderRecurrence.NONE) {
          if (master.scheduled_date === dateKey) {
            const view = viewsById.get(master.id)!;
            results.push({
              reminderId: master.id,
              seriesId: null,
              date: dateKey,
              title: master.title,
              description: master.description,
              repeats: false,
              recurrenceType: ReminderRecurrence.NONE,
              timeMode: master.time_mode,
              startTime: master.start_time,
              endTime: master.end_time,
              isOverride: false,
              completed: completedSet.has(`${master.id}:${dateKey}`),
              reminder: view,
            });
          }
          continue;
        }

        if (!matchesRecurrencePattern(master, date)) {
          continue;
        }
        if (exceptionSet.has(`${master.id}:${dateKey}`)) {
          continue;
        }
        if (overrideByOriginal.has(`${master.id}:${dateKey}`)) {
          continue;
        }

        const view = viewsById.get(master.id)!;
        results.push({
          reminderId: master.id,
          seriesId: master.id,
          date: dateKey,
          title: master.title,
          description: master.description,
          repeats: true,
          recurrenceType: master.recurrence_type,
          timeMode: master.time_mode,
          startTime: master.start_time,
          endTime: master.end_time,
          isOverride: false,
          completed: completedSet.has(`${master.id}:${dateKey}`),
          reminder: view,
        });
      }

      for (const override of overrides) {
        if (override.scheduled_date !== dateKey) {
          continue;
        }
        const view = viewsById.get(override.id)!;
        results.push({
          reminderId: override.id,
          seriesId: override.series_id,
          date: dateKey,
          title: override.title,
          description: override.description,
          repeats: false,
          recurrenceType: ReminderRecurrence.NONE,
          timeMode: override.time_mode,
          startTime: override.start_time,
          endTime: override.end_time,
          isOverride: true,
          completed: completedSet.has(`${override.id}:${dateKey}`),
          reminder: view,
        });
      }
    }

    return results.sort((a, b) =>
      a.date === b.date
        ? a.title.localeCompare(b.title, 'es')
        : a.date.localeCompare(b.date),
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

    return completions.map((completion) => this.toCompletionView(completion));
  }

  async listCompletionsForUser(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<ReminderCompletionView[]> {
    const qb = this.completionsRepository
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .orderBy('c.completed_at', 'DESC');

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      qb.andWhere('c.occurrence_date >= :from', { from });
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      qb.andWhere('c.occurrence_date <= :to', { to });
    }

    const completions = await qb.getMany();
    return completions.map((completion) => this.toCompletionView(completion));
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
      series_id: null,
      series_start:
        schedule.recurrenceType === ReminderRecurrence.NONE
          ? null
          : formatDateKey(new Date()),
      series_until: null,
      original_occurrence_date: null,
      is_override: false,
    });

    const saved = await this.remindersRepository.save(reminder);
    return this.toView(saved);
  }

  async update(
    userId: string,
    reminderId: string,
    dto: UpdateReminderDto,
    timeZone = 'UTC',
  ): Promise<ReminderView> {
    const reminder = await this.findOwnedOrFail(userId, reminderId);
    const safeTimeZone = this.resolveTimeZone(timeZone);

    if (reminder.is_override || reminder.recurrence_type === ReminderRecurrence.NONE) {
      return this.applyDirectUpdate(reminder, dto, safeTimeZone);
    }

    const scope = dto.scope ?? ReminderEditScope.ALL;
    const occurrenceDate = dto.occurrenceDate?.trim();

    if (scope !== ReminderEditScope.ALL) {
      if (!occurrenceDate || !/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
        throw new BadRequestException(
          'occurrenceDate es obligatorio para este alcance.',
        );
      }
    }

    if (scope === ReminderEditScope.THIS) {
      return this.updateThisOccurrence(
        reminder,
        userId,
        occurrenceDate as string,
        dto,
        safeTimeZone,
      );
    }

    if (scope === ReminderEditScope.THIS_AND_FOLLOWING) {
      return this.updateThisAndFollowing(
        reminder,
        userId,
        occurrenceDate as string,
        dto,
        safeTimeZone,
      );
    }

    return this.applyDirectUpdate(reminder, dto, safeTimeZone);
  }

  async remove(
    userId: string,
    reminderId: string,
    scope?: ReminderEditScope,
    occurrenceDate?: string,
  ): Promise<void> {
    const reminder = await this.findOwnedOrFail(userId, reminderId);

    if (reminder.is_override || reminder.recurrence_type === ReminderRecurrence.NONE) {
      if (reminder.is_override && reminder.series_id && reminder.original_occurrence_date) {
        await this.ensureException(
          reminder.series_id,
          userId,
          reminder.original_occurrence_date,
        );
      }
      await this.remindersRepository.remove(reminder);
      return;
    }

    const resolvedScope = scope ?? ReminderEditScope.ALL;

    if (resolvedScope === ReminderEditScope.ALL) {
      await this.remindersRepository.delete({
        series_id: reminder.id,
        user_id: userId,
      });
      await this.remindersRepository.remove(reminder);
      return;
    }

    if (!occurrenceDate || !/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
      throw new BadRequestException(
        'occurrenceDate es obligatorio para este alcance.',
      );
    }

    if (resolvedScope === ReminderEditScope.THIS) {
      await this.ensureException(reminder.id, userId, occurrenceDate);
      const override = await this.remindersRepository.findOne({
        where: {
          series_id: reminder.id,
          original_occurrence_date: occurrenceDate,
          user_id: userId,
        },
      });
      if (override) {
        await this.remindersRepository.remove(override);
      }
      return;
    }

    // this_and_following
    reminder.series_until = dayBeforeKey(occurrenceDate);
    await this.remindersRepository.save(reminder);

    const futureOverrides = await this.remindersRepository.find({
      where: { series_id: reminder.id, user_id: userId, is_override: true },
    });
    const toRemove = futureOverrides.filter(
      (item) =>
        item.original_occurrence_date &&
        item.original_occurrence_date >= occurrenceDate,
    );
    if (toRemove.length > 0) {
      await this.remindersRepository.remove(toRemove);
    }
  }

  private async applyDirectUpdate(
    reminder: Reminder,
    dto: UpdateReminderDto,
    timeZone: string,
  ): Promise<ReminderView> {
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

    if (
      schedule.recurrenceType !== ReminderRecurrence.NONE &&
      !reminder.series_start
    ) {
      reminder.series_start = getSeriesStartKey(reminder);
    }

    const saved = await this.remindersRepository.save(reminder);
    return this.toView(saved, timeZone);
  }

  private async updateThisOccurrence(
    master: Reminder,
    userId: string,
    occurrenceDate: string,
    dto: UpdateReminderDto,
    timeZone: string,
  ): Promise<ReminderView> {
    await this.ensureException(master.id, userId, occurrenceDate);

    const existing = await this.remindersRepository.findOne({
      where: {
        series_id: master.id,
        original_occurrence_date: occurrenceDate,
        user_id: userId,
      },
    });
    if (existing) {
      await this.remindersRepository.remove(existing);
    }

    const schedule = this.normalizeSchedule({
      repeats: false,
      scheduledDate: dto.scheduledDate ?? occurrenceDate,
      timeMode: dto.timeMode ?? master.time_mode,
      startTime: dto.startTime ?? master.start_time ?? undefined,
      endTime: dto.endTime ?? master.end_time ?? undefined,
      notifyEnabled: dto.notifyEnabled ?? master.notify_enabled,
      notifyValue: dto.notifyValue ?? master.notify_value ?? undefined,
      notifyUnit: dto.notifyUnit ?? master.notify_unit ?? undefined,
    });

    const override = this.remindersRepository.create({
      user_id: userId,
      title: (dto.title ?? master.title).trim(),
      description:
        dto.description !== undefined
          ? dto.description?.trim() || null
          : master.description,
      recurrence_type: ReminderRecurrence.NONE,
      scheduled_date: schedule.scheduledDate,
      weekdays: null,
      day_of_month: null,
      month_of_year: null,
      time_mode: schedule.timeMode,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      notify_enabled: schedule.notifyEnabled,
      notify_value: schedule.notifyValue,
      notify_unit: schedule.notifyUnit,
      last_completed_at: null,
      series_id: master.id,
      series_start: null,
      series_until: null,
      original_occurrence_date: occurrenceDate,
      is_override: true,
    });

    const saved = await this.remindersRepository.save(override);

    const completion = await this.completionsRepository.findOne({
      where: {
        reminder_id: master.id,
        user_id: userId,
        occurrence_date: occurrenceDate,
      },
    });
    if (completion) {
      completion.reminder_id = saved.id;
      await this.completionsRepository.save(completion);
    }

    return this.toView(saved, timeZone);
  }

  private async updateThisAndFollowing(
    master: Reminder,
    userId: string,
    occurrenceDate: string,
    dto: UpdateReminderDto,
    timeZone: string,
  ): Promise<ReminderView> {
    master.series_until = dayBeforeKey(occurrenceDate);
    await this.remindersRepository.save(master);

    const repeats = dto.repeats ?? true;
    const schedule = this.normalizeSchedule({
      repeats,
      recurrenceType:
        dto.recurrenceType ??
        (repeats ? master.recurrence_type : ReminderRecurrence.NONE),
      scheduledDate: dto.scheduledDate ?? occurrenceDate,
      weekdays: dto.weekdays ?? master.weekdays ?? undefined,
      dayOfMonth: dto.dayOfMonth ?? master.day_of_month ?? undefined,
      monthOfYear: dto.monthOfYear ?? master.month_of_year ?? undefined,
      timeMode: dto.timeMode ?? master.time_mode,
      startTime: dto.startTime ?? master.start_time ?? undefined,
      endTime: dto.endTime ?? master.end_time ?? undefined,
      notifyEnabled: dto.notifyEnabled ?? master.notify_enabled,
      notifyValue: dto.notifyValue ?? master.notify_value ?? undefined,
      notifyUnit: dto.notifyUnit ?? master.notify_unit ?? undefined,
    });

    const newSeries = this.remindersRepository.create({
      user_id: userId,
      title: (dto.title ?? master.title).trim(),
      description:
        dto.description !== undefined
          ? dto.description?.trim() || null
          : master.description,
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
      series_id: null,
      series_start:
        schedule.recurrenceType === ReminderRecurrence.NONE
          ? null
          : occurrenceDate,
      series_until: null,
      original_occurrence_date: null,
      is_override: false,
    });

    const saved = await this.remindersRepository.save(newSeries);

    const futureOverrides = await this.remindersRepository.find({
      where: { series_id: master.id, user_id: userId, is_override: true },
    });

    for (const override of futureOverrides) {
      if (
        !override.original_occurrence_date ||
        override.original_occurrence_date < occurrenceDate
      ) {
        continue;
      }

      if (
        schedule.recurrenceType !== ReminderRecurrence.NONE &&
        matchesRecurrencePattern(
          saved,
          parseDateKey(override.original_occurrence_date),
        )
      ) {
        override.series_id = saved.id;
        await this.remindersRepository.save(override);
        await this.ensureException(
          saved.id,
          userId,
          override.original_occurrence_date,
        );
      } else {
        await this.remindersRepository.remove(override);
      }
    }

    const futureExceptions = await this.exceptionsRepository.find({
      where: { reminder_id: master.id, user_id: userId },
    });
    for (const exception of futureExceptions) {
      if (exception.occurrence_date < occurrenceDate) {
        continue;
      }
      await this.ensureException(saved.id, userId, exception.occurrence_date);
      await this.exceptionsRepository.remove(exception);
    }

    return this.toView(saved, timeZone);
  }

  private async ensureException(
    reminderId: string,
    userId: string,
    occurrenceDate: string,
  ): Promise<void> {
    const existing = await this.exceptionsRepository.findOne({
      where: {
        reminder_id: reminderId,
        occurrence_date: occurrenceDate,
        user_id: userId,
      },
    });
    if (existing) {
      return;
    }
    await this.exceptionsRepository.save(
      this.exceptionsRepository.create({
        reminder_id: reminderId,
        user_id: userId,
        occurrence_date: occurrenceDate,
      }),
    );
  }

  async setCompletion(
    userId: string,
    reminderId: string,
    dto: SetReminderCompletionDto,
    timeZone = 'UTC',
  ): Promise<ReminderView> {
    const safeTimeZone = this.resolveTimeZone(timeZone);
    const reminder = await this.findOwnedOrFail(userId, reminderId);
    const occurrenceDate = dto.occurrenceDate?.trim() || null;

    if (occurrenceDate) {
      await this.setCompletionForOccurrence(
        reminder,
        userId,
        occurrenceDate,
        dto.completed,
        safeTimeZone,
      );
      const saved = await this.remindersRepository.save(reminder);
      return this.toView(saved, safeTimeZone);
    }

    const currentlyCompleted = this.isCompletedForCurrentPeriod(
      reminder,
      safeTimeZone,
    );
    const nextCompleted =
      typeof dto.completed === 'boolean' ? dto.completed : !currentlyCompleted;

    if (nextCompleted && !currentlyCompleted) {
      const completedAt = new Date();
      const resolvedDate = this.resolveOccurrenceDate(reminder, completedAt);

      await this.completionsRepository.save(
        this.completionsRepository.create({
          reminder_id: reminder.id,
          user_id: userId,
          completed_at: completedAt,
          occurrence_date: resolvedDate,
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

  private toCompletionView(
    completion: ReminderCompletion,
  ): ReminderCompletionView {
    return {
      id: completion.id,
      reminderId: completion.reminder_id,
      completedAt: completion.completed_at.toISOString(),
      occurrenceDate: completion.occurrence_date,
    };
  }

  private async setCompletionForOccurrence(
    reminder: Reminder,
    userId: string,
    occurrenceDate: string,
    completed: boolean | undefined,
    timeZone: string,
  ): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
      throw new BadRequestException('Fecha de ocurrencia inválida.');
    }

    const existing = await this.completionsRepository.findOne({
      where: {
        reminder_id: reminder.id,
        user_id: userId,
        occurrence_date: occurrenceDate,
      },
    });

    const nextCompleted =
      typeof completed === 'boolean' ? completed : !existing;

    if (nextCompleted && !existing) {
      const completedAt = new Date();
      await this.completionsRepository.save(
        this.completionsRepository.create({
          reminder_id: reminder.id,
          user_id: userId,
          completed_at: completedAt,
          occurrence_date: occurrenceDate,
        }),
      );

      if (
        this.isOccurrenceDateInCurrentPeriod(reminder, occurrenceDate, timeZone)
      ) {
        reminder.last_completed_at = completedAt;
      }
      return;
    }

    if (!nextCompleted && existing) {
      await this.completionsRepository.remove(existing);

      if (
        this.isOccurrenceDateInCurrentPeriod(reminder, occurrenceDate, timeZone)
      ) {
        const latestCurrent = await this.findLatestCurrentPeriodCompletion(
          reminder,
          userId,
          timeZone,
        );
        reminder.last_completed_at = latestCurrent?.completed_at ?? null;
      }
    }
  }

  private async findLatestCurrentPeriodCompletion(
    reminder: Reminder,
    userId: string,
    timeZone: string,
  ): Promise<ReminderCompletion | null> {
    const completions = await this.completionsRepository.find({
      where: { reminder_id: reminder.id, user_id: userId },
      order: { completed_at: 'DESC' },
    });

    return (
      completions.find((completion) =>
        this.completionBelongsToCurrentPeriod(
          reminder,
          completion.completed_at,
          timeZone,
        ),
      ) ?? null
    );
  }

  private isOccurrenceDateInCurrentPeriod(
    reminder: Reminder,
    occurrenceDate: string,
    timeZone: string,
  ): boolean {
    const nowParts = this.getZonedDateParts(new Date(), timeZone);
    const [year, month] = occurrenceDate.split('-').map(Number);

    switch (reminder.recurrence_type) {
      case ReminderRecurrence.NONE:
        return true;
      case ReminderRecurrence.WEEKLY:
        return occurrenceDate === nowParts.date;
      case ReminderRecurrence.MONTHLY:
        return year === nowParts.year && month === nowParts.month;
      case ReminderRecurrence.YEARLY:
        return year === nowParts.year;
      default:
        return false;
    }
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
    const seriesStartKey = getSeriesStartKey(reminder);
    const seriesStart = parseDateKey(seriesStartKey);
    const fromDay = this.startOfDay(from);
    const cursor = fromDay < seriesStart ? seriesStart : fromDay;
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
      const dateKey = this.formatDate(candidateDate);
      if (reminder.series_until && dateKey > reminder.series_until) {
        break;
      }
      if (!matchesRecurrencePattern(reminder, candidateDate)) {
        continue;
      }

      const occurrence = this.combineDateAndTime(dateKey, reminder);

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
    return matchesRecurrencePattern(reminder, date);
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
    if (reminder.seriesUntil && today.date > reminder.seriesUntil) {
      return false;
    }
    if (reminder.seriesStart && today.date < reminder.seriesStart) {
      return false;
    }

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
      seriesId: reminder.series_id,
      seriesStart: reminder.series_start ?? getSeriesStartKey(reminder),
      seriesUntil: reminder.series_until,
      originalOccurrenceDate: reminder.original_occurrence_date,
      isOverride: reminder.is_override ?? false,
      createdAt: reminder.created_at.toISOString(),
      updatedAt: reminder.updated_at.toISOString(),
    };
  }
}