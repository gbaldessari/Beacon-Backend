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
import { FinanceBudgetPeriod } from '../finance.enums';
import { FinanceCategory } from './finance-category.entity';
import { FinanceSpace } from './finance-space.entity';
import { FinanceTag } from './finance-tag.entity';

@Entity({ name: 'finance_budgets' })
export class FinanceBudget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  space_id!: string;

  @Column({ type: 'varchar', length: 20, default: FinanceBudgetPeriod.MONTHLY })
  period!: FinanceBudgetPeriod;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'int' })
  month!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'uuid', nullable: true })
  category_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  tag_id!: string | null;

  @ManyToOne(() => FinanceSpace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'space_id' })
  space!: FinanceSpace;

  @ManyToOne(() => FinanceCategory, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category!: FinanceCategory | null;

  @ManyToOne(() => FinanceTag, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tag_id' })
  tag!: FinanceTag | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
