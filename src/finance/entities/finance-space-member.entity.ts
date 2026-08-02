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
import { FinanceMemberRole } from '../finance.enums';
import { FinanceSpace } from './finance-space.entity';

@Entity({ name: 'finance_space_members' })
@Unique(['space_id', 'user_id'])
export class FinanceSpaceMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  space_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: FinanceMemberRole;

  @ManyToOne(() => FinanceSpace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'space_id' })
  space!: FinanceSpace;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
