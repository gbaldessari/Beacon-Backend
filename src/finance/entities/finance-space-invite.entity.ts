import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FinanceInviteStatus, FinanceMemberRole } from '../finance.enums';
import { FinanceSpace } from './finance-space.entity';

@Entity({ name: 'finance_space_invites' })
export class FinanceSpaceInvite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  space_id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  token!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: FinanceMemberRole;

  @Column({ type: 'varchar', length: 20, default: FinanceInviteStatus.PENDING })
  status!: FinanceInviteStatus;

  @Column({ type: 'uuid' })
  invited_by!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @ManyToOne(() => FinanceSpace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'space_id' })
  space!: FinanceSpace;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
