import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ReminderNotifyUnit,
  ReminderRecurrence,
  ReminderTimeMode,
} from '../reminder-recurrence.enum';

/**
 * Recordatorio o tarea del usuario (única, serie o override de una fecha).
 */
@Entity({ name: 'reminders' })
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  calendar_id!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  /**
   * none | weekly | monthly | yearly
   */
  @Column({ type: 'varchar', length: 20 })
  recurrence_type!: ReminderRecurrence;

  /**
   * Fecha única (YYYY-MM-DD) cuando no se repite.
   */
  @Column({ type: 'date', nullable: true })
  scheduled_date!: string | null;

  /**
   * Días de la semana (0 = domingo … 6 = sábado). Solo semanal.
   */
  @Column({ type: 'smallint', array: true, nullable: true })
  weekdays!: number[] | null;

  @Column({ type: 'smallint', nullable: true })
  day_of_month!: number | null;

  @Column({ type: 'smallint', nullable: true })
  month_of_year!: number | null;

  @Column({ type: 'varchar', length: 20, default: ReminderTimeMode.ALL_DAY })
  time_mode!: ReminderTimeMode;

  /** Hora de inicio HH:mm */
  @Column({ type: 'varchar', length: 5, nullable: true })
  start_time!: string | null;

  /** Hora de fin HH:mm (solo rango) */
  @Column({ type: 'varchar', length: 5, nullable: true })
  end_time!: string | null;

  @Column({ type: 'boolean', default: false })
  notify_enabled!: boolean;

  @Column({ type: 'integer', nullable: true })
  notify_value!: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  notify_unit!: ReminderNotifyUnit | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  last_completed_at!: Date | null;

  /**
   * Serie maestra de un override. Null = es maestro o único independiente.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  series_id!: string | null;

  /**
   * Primera fecha incluida de la serie (YYYY-MM-DD). Null = usar created_at.
   */
  @Column({ type: 'date', nullable: true })
  series_start!: string | null;

  /**
   * Última fecha incluida de la serie (YYYY-MM-DD). Null = sin fin.
   */
  @Column({ type: 'date', nullable: true })
  series_until!: string | null;

  /**
   * Fecha original de la ocurrencia desviada (solo overrides).
   */
  @Column({ type: 'date', nullable: true })
  original_occurrence_date!: string | null;

  @Column({ type: 'boolean', default: false })
  is_override!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
