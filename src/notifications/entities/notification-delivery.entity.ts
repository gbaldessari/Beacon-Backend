import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
} from '../notifications.enums';

@Entity({ name: 'notification_deliveries' })
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 20 })
  channel!: NotificationChannel;

  @Column({ type: 'varchar', length: 255, unique: true })
  dedupe_key!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: NotificationDeliveryStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  error!: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}
