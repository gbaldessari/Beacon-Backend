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
import { CalendarMemberRole } from '../calendar.enums';
import { Calendar } from './calendar.entity';

@Entity({ name: 'calendar_members' })
@Unique(['calendar_id', 'user_id'])
export class CalendarMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  calendar_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: CalendarMemberRole;

  @ManyToOne(() => Calendar, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'calendar_id' })
  calendar!: Calendar;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
