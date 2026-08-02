import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CalendarInviteStatus, CalendarMemberRole } from '../calendar.enums';
import { Calendar } from './calendar.entity';

@Entity({ name: 'calendar_invites' })
export class CalendarInvite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  calendar_id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  token!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: CalendarMemberRole;

  @Column({ type: 'varchar', length: 20, default: CalendarInviteStatus.PENDING })
  status!: CalendarInviteStatus;

  @Column({ type: 'uuid' })
  invited_by!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @ManyToOne(() => Calendar, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'calendar_id' })
  calendar!: Calendar;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
