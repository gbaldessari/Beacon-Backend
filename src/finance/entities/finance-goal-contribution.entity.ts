import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FinanceGoal } from './finance-goal.entity';

@Entity({ name: 'finance_goal_contributions' })
export class FinanceGoalContribution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  goal_id!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'date' })
  occurred_at!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ type: 'uuid' })
  created_by!: string;

  @Column({ type: 'uuid', nullable: true })
  transaction_id!: string | null;

  @ManyToOne(() => FinanceGoal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goal_id' })
  goal!: FinanceGoal;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
