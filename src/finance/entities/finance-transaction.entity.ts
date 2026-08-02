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
import { FinanceTransactionType } from '../finance.enums';
import { FinanceCategory } from './finance-category.entity';
import { FinanceSpace } from './finance-space.entity';

@Entity({ name: 'finance_transactions' })
export class FinanceTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  space_id!: string;

  @Column({ type: 'uuid' })
  created_by!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: FinanceTransactionType;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Index()
  @Column({ type: 'date' })
  occurred_at!: string;

  @Column({ type: 'uuid' })
  category_id!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  reminder_id!: string | null;

  @ManyToOne(() => FinanceSpace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'space_id' })
  space!: FinanceSpace;

  @ManyToOne(() => FinanceCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: FinanceCategory;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
