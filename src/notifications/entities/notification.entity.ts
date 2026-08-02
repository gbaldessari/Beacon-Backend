import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationType } from '../notifications.enums';

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 1000 })
  body!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  link!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  read_at!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}
