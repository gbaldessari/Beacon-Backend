import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  ReminderNotifyUnit,
  ReminderRecurrence,
  ReminderTimeMode,
} from '../reminder-recurrence.enum';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DTO para crear un recordatorio o tarea.
 */
export class CreateReminderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  repeats!: boolean;

  @ValidateIf((dto: CreateReminderDto) => dto.repeats === true)
  @IsEnum(ReminderRecurrence)
  recurrenceType?: ReminderRecurrence;

  @ValidateIf((dto: CreateReminderDto) => dto.repeats === false)
  @IsString()
  @Matches(DATE_RE)
  scheduledDate?: string;

  @ValidateIf(
    (dto: CreateReminderDto) =>
      dto.repeats === true && dto.recurrenceType === ReminderRecurrence.WEEKLY,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @ValidateIf(
    (dto: CreateReminderDto) =>
      dto.repeats === true &&
      (dto.recurrenceType === ReminderRecurrence.MONTHLY ||
        dto.recurrenceType === ReminderRecurrence.YEARLY),
  )
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @ValidateIf(
    (dto: CreateReminderDto) =>
      dto.repeats === true && dto.recurrenceType === ReminderRecurrence.YEARLY,
  )
  @IsInt()
  @Min(1)
  @Max(12)
  monthOfYear?: number;

  @IsEnum(ReminderTimeMode)
  timeMode!: ReminderTimeMode;

  @ValidateIf(
    (dto: CreateReminderDto) =>
      dto.timeMode === ReminderTimeMode.TIME ||
      dto.timeMode === ReminderTimeMode.RANGE,
  )
  @IsString()
  @Matches(TIME_RE)
  startTime?: string;

  @ValidateIf((dto: CreateReminderDto) => dto.timeMode === ReminderTimeMode.RANGE)
  @IsString()
  @Matches(TIME_RE)
  endTime?: string;

  @IsBoolean()
  notifyEnabled!: boolean;

  @ValidateIf((dto: CreateReminderDto) => dto.notifyEnabled === true)
  @IsInt()
  @Min(1)
  @Max(365)
  notifyValue?: number;

  @ValidateIf((dto: CreateReminderDto) => dto.notifyEnabled === true)
  @IsEnum(ReminderNotifyUnit)
  notifyUnit?: ReminderNotifyUnit;
}

/**
 * DTO para actualizar un recordatorio.
 */
export class UpdateReminderDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  repeats?: boolean;

  @IsOptional()
  @IsEnum(ReminderRecurrence)
  recurrenceType?: ReminderRecurrence;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE)
  scheduledDate?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  monthOfYear?: number | null;

  @IsOptional()
  @IsEnum(ReminderTimeMode)
  timeMode?: ReminderTimeMode;

  @IsOptional()
  @IsString()
  @Matches(TIME_RE)
  startTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(TIME_RE)
  endTime?: string | null;

  @IsOptional()
  @IsBoolean()
  notifyEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  notifyValue?: number | null;

  @IsOptional()
  @IsEnum(ReminderNotifyUnit)
  notifyUnit?: ReminderNotifyUnit | null;
}

/**
 * DTO para marcar o desmarcar completado.
 */
export class SetReminderCompletionDto {
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
