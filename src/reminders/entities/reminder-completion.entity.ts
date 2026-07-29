import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Reminder } from './reminder.entity';

/**
 * Historial de cada vez que un recordatorio se marca como completado.
 */
@Entity({ name: 'reminder_completions' })
export class ReminderCompletion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  reminder_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  /**
   * Momento en que se marcó como hecho.
   */
  @CreateDateColumn({ type: 'timestamp with time zone' })
  completed_at!: Date;

  /**
   * Fecha de la ocurrencia completada (YYYY-MM-DD), para trazabilidad.
   */
  @Column({ type: 'date', nullable: true })
  occurrence_date!: string | null;

  @ManyToOne(() => Reminder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reminder_id' })
  reminder!: Reminder;
}
