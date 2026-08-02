import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { FinanceTag } from './finance-tag.entity';
import { FinanceTransaction } from './finance-transaction.entity';

@Entity({ name: 'finance_transaction_tags' })
export class FinanceTransactionTag {
  @PrimaryColumn({ type: 'uuid' })
  transaction_id!: string;

  @PrimaryColumn({ type: 'uuid' })
  tag_id!: string;

  @ManyToOne(() => FinanceTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: FinanceTransaction;

  @ManyToOne(() => FinanceTag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag!: FinanceTag;
}
