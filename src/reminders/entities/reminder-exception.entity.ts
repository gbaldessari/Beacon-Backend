import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Reminder } from './reminder.entity';

/**
 * Fecha excluida de una serie recurrente (EXDATE).
 */
@Entity({ name: 'reminder_exceptions' })
@Unique(['reminder_id', 'occurrence_date'])
export class ReminderException {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  reminder_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'date' })
  occurrence_date!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @ManyToOne(() => Reminder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reminder_id' })
  reminder!: Reminder;
}
