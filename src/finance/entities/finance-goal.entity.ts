import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FinanceGoalStatus } from '../finance.enums';
import { FinanceSpace } from './finance-space.entity';

@Entity({ name: 'finance_goals' })
export class FinanceGoal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  space_id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  target_amount!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  current_amount!: string;

  @Column({ type: 'date', nullable: true })
  deadline!: string | null;

  @Column({ type: 'varchar', length: 20, default: FinanceGoalStatus.ACTIVE })
  status!: FinanceGoalStatus;

  @Column({ type: 'uuid' })
  created_by!: string;

  @ManyToOne(() => FinanceSpace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'space_id' })
  space!: FinanceSpace;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
