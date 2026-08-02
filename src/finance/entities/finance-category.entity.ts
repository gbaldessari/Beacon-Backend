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
import { FinanceCategoryKind } from '../finance.enums';
import { FinanceSpace } from './finance-space.entity';

@Entity({ name: 'finance_categories' })
export class FinanceCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  space_id!: string;

  @Column({ type: 'uuid', nullable: true })
  parent_id!: string | null;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: FinanceCategoryKind.ANY })
  kind!: FinanceCategoryKind;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color!: string | null;

  @ManyToOne(() => FinanceSpace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'space_id' })
  space!: FinanceSpace;

  @ManyToOne(() => FinanceCategory, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: FinanceCategory | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
