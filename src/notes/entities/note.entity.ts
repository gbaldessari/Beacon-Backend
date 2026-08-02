import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NoteChecklistItem } from './note-checklist-item.entity';
import { NoteLabel } from './note-label.entity';

@Entity({ name: 'notes' })
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  title!: string;

  @Column({ type: 'text', default: '' })
  body!: string;

  @Column({ type: 'varchar', length: 32, default: '#fff9c4' })
  color!: string;

  @Column({ type: 'boolean', default: false })
  pinned!: boolean;

  @Column({ type: 'boolean', default: false })
  archived!: boolean;

  @Column({ type: 'boolean', default: false })
  is_checklist!: boolean;

  @Column({ type: 'integer', default: 0 })
  position!: number;

  @OneToMany(() => NoteChecklistItem, (item) => item.note, {
    cascade: true,
    eager: true,
  })
  checklist_items!: NoteChecklistItem[];

  @ManyToMany(() => NoteLabel, (label) => label.notes, { eager: true })
  @JoinTable({
    name: 'note_label_links',
    joinColumn: { name: 'note_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'label_id', referencedColumnName: 'id' },
  })
  labels!: NoteLabel[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
